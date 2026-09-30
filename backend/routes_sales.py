from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core import db, uid, now_iso, today, doc_number, get_user, require_admin, is_admin, strip_keys, NO_ID
from services import (prep_line, adjust_stock, stock_units, sale_totals, compute_status, create_indent_pos,
                      sync_indent_pos, f, STATUS_LABELS)

router = APIRouter(prefix="/api")


def out(sale, user):
    return sale if is_admin(user) else strip_keys(sale)


async def get_sale(sid):
    sale = await db.sales.find_one({"id": sid}, NO_ID)
    if not sale:
        raise HTTPException(404, "Nota tidak ditemukan")
    return sale


async def upsert_customer(data: dict) -> dict:
    cust = dict(data.get("customer") or {})
    cust["name"] = (cust.get("name") or "").strip() or "Pelanggan Umum / CASH"
    if data.get("save_customer") and not cust.get("id") and cust["name"] != "Pelanggan Umum / CASH":
        doc = {"id": uid(), "name": cust["name"], "phone": cust.get("phone", ""), "address": cust.get("address", ""),
               "type": cust.get("type") or "Umum", "status": cust.get("status", ""), "created_at": now_iso()}
        await db.customers.insert_one(dict(doc))
        cust["id"] = doc["id"]
    return cust


async def create_sale(data: dict, user: dict, date: Optional[str] = None) -> dict:
    if data.get("offline_id"):
        exist = await db.sales.find_one({"offline_id": data["offline_id"]}, NO_ID)
        if exist:
            return exist
    if not data.get("items"):
        raise HTTPException(400, "Keranjang masih kosong")
    items = [await prep_line(it, {}) for it in data["items"]]
    sale = {"id": uid(), "invoice_no": await doc_number("HB"), "date": date or data.get("date") or today(),
            "customer": await upsert_customer(data), "delivery_date": data.get("delivery_date"),
            "delivery_address": data.get("delivery_address") or (data.get("customer") or {}).get("address", ""),
            "notes": data.get("notes", ""), "items": items, "ongkir": f(data.get("ongkir")),
            "payment_method": data.get("payment_method", "Tunai"), "due_date": data.get("due_date"),
            "payments": [], "deliveries": [], "voided": False, "cashier": user["name"],
            "offline_id": data.get("offline_id"), "created_at": now_iso()}
    sale_totals(sale)
    method = sale["payment_method"]
    paid = sale["grand_total"] if method in ("Tunai", "Transfer") else (f(data.get("dp_amount")) if method == "DP" else 0)
    paid = min(paid, sale["grand_total"])
    if paid > 0:
        sale["payments"].append({"id": uid(), "date": sale["date"], "amount": paid, "method": data.get("dp_method") or method,
                                 "note": "Pembayaran awal", "by": user["name"]})
    sale_totals(sale)
    sale["credit_approved"] = sale["balance"] <= 0
    for it in items:
        if it["mode"] == "ready":
            await adjust_stock(it.get("product_id"), it.get("warehouse"), -stock_units(it))
    await create_indent_pos(sale, [i for i in items if i["mode"] == "indent"])
    sale["order_status"] = compute_status(sale)
    await db.sales.insert_one(dict(sale))
    return sale


@router.post("/sales")
async def post_sale(body: dict, user=Depends(get_user)):
    return out(await create_sale(body, user), user)


@router.get("/sales")
async def list_sales(q: str = "", customer_id: str = "", status: str = "", payment_status: str = "",
                     date_field: str = "date", date_from: str = "", date_to: str = "", include_void: bool = False,
                     user=Depends(get_user)):
    query = {} if include_void else {"voided": {"$ne": True}}
    if customer_id:
        query["customer.id"] = customer_id
    if status:
        query["order_status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    field = "delivery_date" if date_field == "delivery" else "date"
    rng = {}
    if date_from:
        rng["$gte"] = date_from
    if date_to:
        rng["$lte"] = date_to
    if rng:
        query[field] = rng
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"invoice_no": rx}, {"customer.name": rx}, {"customer.phone": rx}, {"notes": rx},
                        {"items.name": rx}, {"delivery_address": rx}, {"cashier": rx}]
    sales = await db.sales.find(query, NO_ID).sort("created_at", -1).to_list(2000)
    summary = {"count": len(sales), "grand_total": sum(s["grand_total"] for s in sales),
               "paid_total": sum(s["paid_total"] for s in sales), "balance": sum(s["balance"] for s in sales),
               "ongkir": sum(s["ongkir"] for s in sales)}
    return {"items": out(sales, user), "summary": summary}


@router.get("/sales/{sid}")
async def sale_detail(sid: str, user=Depends(get_user)):
    return out(await get_sale(sid), user)


@router.put("/sales/{sid}")
async def edit_sale(sid: str, body: dict, user=Depends(require_admin)):
    sale = await get_sale(sid)
    if sale.get("voided"):
        raise HTTPException(400, "Nota sudah di-void")
    old_lines = {i["line_id"]: i for i in sale["items"]}
    for it in sale["items"]:
        if it["mode"] == "ready":
            await adjust_stock(it.get("product_id"), it.get("warehouse"), stock_units(it))
    items = [await prep_line(it, old_lines) for it in body.get("items", [])]
    if not items:
        raise HTTPException(400, "Nota minimal 1 item")
    for it in items:
        if it["mode"] == "ready":
            await adjust_stock(it.get("product_id"), it.get("warehouse"), -stock_units(it))
    keep = {i["line_id"] for i in items}
    removed = [i for lid, i in old_lines.items() if lid not in keep and i["mode"] == "indent"]
    for k in ("delivery_date", "notes", "ongkir", "due_date", "delivery_address", "customer"):
        if k in body:
            sale[k] = body[k]
    sale["items"] = items
    sale_totals(sale)
    await create_indent_pos(sale, [i for i in items if i["mode"] == "indent" and not i.get("po_id")])
    await sync_indent_pos(sale, removed)
    sale["order_status"] = compute_status(sale)
    sale["edited_at"], sale["edited_by"] = now_iso(), user["name"]
    await db.sales.replace_one({"id": sid}, sale)
    return sale


@router.post("/sales/{sid}/void")
async def void_sale(sid: str, body: dict = None, user=Depends(require_admin)):
    sale = await get_sale(sid)
    if sale.get("voided"):
        return sale
    for it in sale["items"]:
        if it["mode"] == "ready":
            await adjust_stock(it.get("product_id"), it.get("warehouse"), stock_units(it))
    await db.purchases.update_many({"sale_id": sid, "receive_status": {"$in": ["Draft", "Dalam Proses"]}},
                                   {"$set": {"voided": True}})
    upd = {"voided": True, "void_reason": (body or {}).get("reason", ""), "voided_by": user["name"], "voided_at": now_iso()}
    await db.sales.update_one({"id": sid}, {"$set": upd})
    return {**sale, **upd}


@router.post("/sales/{sid}/payments")
async def add_payment(sid: str, body: dict, user=Depends(get_user)):
    sale = await get_sale(sid)
    amount = f(body.get("amount"))
    if amount <= 0 or amount > sale["balance"] + 0.5:
        raise HTTPException(400, "Nominal pelunasan tidak valid")
    sale["payments"].append({"id": uid(), "date": body.get("date") or today(), "amount": amount,
                             "method": body.get("method", "Tunai"), "note": body.get("note", "Pelunasan"), "by": user["name"]})
    sale_totals(sale)
    await db.sales.replace_one({"id": sid}, sale)
    return out(sale, user)


@router.post("/sales/{sid}/deliveries")
async def add_delivery(sid: str, body: dict, user=Depends(get_user)):
    sale = await get_sale(sid)
    lines = {i["line_id"]: i for i in sale["items"]}
    sj_items = []
    for d in body.get("items", []):
        ln, qty = lines.get(d.get("line_id")), f(d.get("qty"))
        if not ln or qty <= 0:
            continue
        if qty > f(ln["qty"]) - f(ln.get("delivered_qty")) + 1e-9:
            raise HTTPException(400, f"Qty kirim {ln['name']} melebihi sisa")
        ln["delivered_qty"] = f(ln.get("delivered_qty")) + qty
        sj_items.append({"line_id": ln["line_id"], "name": ln["name"], "qty": qty, "unit": ln.get("unit"),
                         "is_length": ln.get("is_length"), "length": ln.get("length"), "bend": ln.get("bend"),
                         "total_meter": round(qty * f(ln.get("length")), 2) if ln.get("is_length") else 0,
                         "warehouse": ln.get("warehouse")})
    if not sj_items:
        raise HTTPException(400, "Pilih minimal 1 item untuk dikirim")
    rit = {"id": uid(), "sj_no": await doc_number("SJ"), "rit": len(sale["deliveries"]) + 1,
           "date": body.get("date") or today(), "warehouse": body.get("warehouse", ""),
           "address": body.get("address") or sale.get("delivery_address", ""), "driver": body.get("driver", ""),
           "vehicle": body.get("vehicle", ""), "items": sj_items, "by": user["name"], "created_at": now_iso()}
    sale["deliveries"].append(rit)
    sale["order_status"] = compute_status(sale)
    await db.sales.replace_one({"id": sid}, sale)
    return {"sale": out(sale, user), "delivery": rit}


@router.patch("/sales/{sid}/status")
async def set_status(sid: str, body: dict, user=Depends(get_user)):
    st = body.get("order_status")
    if st not in STATUS_LABELS:
        raise HTTPException(400, "Status tidak valid")
    await db.sales.update_one({"id": sid}, {"$set": {"order_status": st}})
    return out(await get_sale(sid), user)


@router.post("/sales/{sid}/approve-credit")
async def approve_credit(sid: str, user=Depends(require_admin)):
    await db.sales.update_one({"id": sid}, {"$set": {"credit_approved": True, "approved_by": user["name"]}})
    return {"ok": True}
