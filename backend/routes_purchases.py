from fastapi import APIRouter, Depends, HTTPException

from core import db, uid, now_iso, today, po_number, get_user, require_admin, is_admin, strip_keys, PO_MONEY_KEYS, NO_ID
from services import calc_po_item, po_totals, adjust_stock, refresh_sale_status, f, RECEIVE_STATUSES

router = APIRouter(prefix="/api")


def out(po, user):
    return po if is_admin(user) else strip_keys(po, PO_MONEY_KEYS)


async def get_po(pid):
    po = await db.purchases.find_one({"id": pid}, NO_ID)
    if not po:
        raise HTTPException(404, "PO tidak ditemukan")
    return po


async def build_items(raw_items):
    items = []
    for r in raw_items:
        it = {k: r.get(k) for k in ("line_id", "product_id", "name", "category_name", "is_length", "length", "qty",
                                     "unit", "bend", "brand", "thickness", "color", "hpp_unit", "ratio",
                                     "sale_line_id", "received_qty", "stock_applied")}
        it = {k: v for k, v in it.items() if v is not None}
        if f(it.get("qty")) <= 0:
            raise HTTPException(400, "Qty item PO harus > 0")
        items.append(calc_po_item(it))
    return items


async def update_product_hpp(po):
    for it in po["items"]:
        if it.get("product_id") and f(it.get("hpp_unit")) > 0 and po["type"] == "manual":
            await db.products.update_one({"id": it["product_id"]}, {"$set": {"hpp": f(it["hpp_unit"])}})


async def sync_sale_hpp(po):
    if po["type"] != "indent" or not po.get("sale_id"):
        return
    sale = await db.sales.find_one({"id": po["sale_id"]}, NO_ID)
    if not sale:
        return
    hpp = {i.get("sale_line_id"): f(i.get("hpp_unit")) for i in po["items"]}
    from services import calc_line, sale_totals
    for ln in sale["items"]:
        if ln["line_id"] in hpp:
            ln["hpp_unit"] = hpp[ln["line_id"]]
            calc_line(ln)
    sale_totals(sale)
    await db.sales.replace_one({"id": sale["id"]}, sale)


@router.get("/purchases")
async def list_pos(q: str = "", supplier_id: str = "", status: str = "", type: str = "", date_from: str = "",
                   date_to: str = "", user=Depends(get_user)):
    query = {"voided": {"$ne": True}}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if status:
        query["receive_status"] = status
    if type:
        query["type"] = type
    rng = {**({"$gte": date_from} if date_from else {}), **({"$lte": date_to} if date_to else {})}
    if rng:
        query["date"] = rng
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"po_no": rx}, {"supplier_name": rx}, {"invoice_no": rx}, {"customer_name": rx}, {"items.name": rx}]
    pos = await db.purchases.find(query, NO_ID).sort("created_at", -1).to_list(2000)
    summary = {"count": len(pos), "total": sum(p["total"] for p in pos), "debt": sum(p["debt"] for p in pos)}
    return {"items": out(pos, user), "summary": summary if is_admin(user) else {"count": len(pos)}}


@router.get("/purchases/{pid}")
async def po_detail(pid: str, user=Depends(get_user)):
    return out(await get_po(pid), user)


@router.post("/purchases")
async def create_po(body: dict, user=Depends(require_admin)):
    sup = await db.suppliers.find_one({"id": body.get("supplier_id")}, NO_ID)
    if not sup:
        raise HTTPException(400, "Pilih supplier")
    po = {"id": uid(), "po_no": await po_number(sup["prefix"]), "type": "manual", "supplier_id": sup["id"],
          "supplier_name": sup["name"], "date": body.get("date") or today(), "warehouse": body.get("warehouse", "G1"),
          "items": await build_items(body.get("items", [])), "receive_status": "Draft",
          "paid_status": body.get("paid_status", "Belum Bayar"), "paid_amount": f(body.get("paid_amount")),
          "total_manual": body.get("total_manual"), "status_log": [], "voided": False, "notes": body.get("notes", ""),
          "created_by": user["name"], "created_at": now_iso()}
    if not po["items"]:
        raise HTTPException(400, "Item PO masih kosong")
    po_totals(po)
    await db.purchases.insert_one(dict(po))
    await update_product_hpp(po)
    return po


@router.put("/purchases/{pid}")
async def edit_po(pid: str, body: dict, user=Depends(require_admin)):
    po = await get_po(pid)
    if "items" in body:
        old = {i["line_id"]: i for i in po["items"]}
        for r in body["items"]:
            o = old.get(r.get("line_id"))
            if o:
                r["received_qty"], r["stock_applied"] = o.get("received_qty", 0), o.get("stock_applied", 0)
        removed = [o for lid, o in old.items() if lid not in {r.get("line_id") for r in body["items"]}]
        for o in removed:
            await adjust_stock(o.get("product_id"), po.get("stock_wh"), -f(o.get("stock_applied")))
        po["items"] = await build_items(body["items"])
    for k in ("date", "notes", "paid_status", "paid_amount", "total_manual", "warehouse"):
        if k in body:
            po[k] = body[k]
    po_totals(po)
    po["edited_at"], po["edited_by"] = now_iso(), user["name"]
    await db.purchases.replace_one({"id": pid}, po)
    await update_product_hpp(po)
    await sync_sale_hpp(po)
    return po


@router.patch("/purchases/{pid}/receive")
async def receive_po(pid: str, body: dict, user=Depends(get_user)):
    po = await get_po(pid)
    status, wh = body.get("status"), body.get("warehouse") or po.get("warehouse", "G1")
    if status not in RECEIVE_STATUSES:
        raise HTTPException(400, "Status penerimaan tidak valid")
    old_wh = po.get("stock_wh")
    if old_wh and old_wh != wh:
        for it in po["items"]:
            await adjust_stock(it.get("product_id"), old_wh, -f(it.get("stock_applied")))
            await adjust_stock(it.get("product_id"), wh, f(it.get("stock_applied")))
    given = {i.get("line_id"): f(i.get("received_qty")) for i in body.get("items", [])}
    sale_updates = {}
    for it in po["items"]:
        qty = f(it["qty"])
        rq = {"Barang Diterima": qty, "Barang Direject Semua": 0}.get(status, it.get("received_qty", 0))
        if status == "Barang Belum Lengkap":
            rq = min(given.get(it["line_id"], f(it.get("received_qty"))), qty)
        it["received_qty"] = rq
        if po["type"] == "manual" and it.get("product_id"):
            units = rq * (f(it.get("ratio")) or 1)
            await adjust_stock(it["product_id"], wh, units - f(it.get("stock_applied")))
            it["stock_applied"] = units
        if it.get("sale_line_id"):
            sale_updates[it["sale_line_id"]] = rq >= qty > 0
    po["warehouse"], po["stock_wh"], po["receive_status"] = wh, wh, status
    po["status_log"].append({"date": now_iso(), "status": status, "warehouse": wh, "by": user["name"],
                             "note": body.get("note", "")})
    await db.purchases.replace_one({"id": pid}, po)
    if po.get("sale_id") and sale_updates:
        sale = await db.sales.find_one({"id": po["sale_id"]}, NO_ID)
        if sale:
            for ln in sale["items"]:
                if ln["line_id"] in sale_updates:
                    ln["indent_received"] = sale_updates[ln["line_id"]]
                    ln["warehouse"] = wh
            await db.sales.replace_one({"id": sale["id"]}, sale)
            await refresh_sale_status(sale["id"])
    return out(po, user)


@router.post("/purchases/{pid}/void")
async def void_po(pid: str, user=Depends(require_admin)):
    po = await get_po(pid)
    for it in po["items"]:
        await adjust_stock(it.get("product_id"), po.get("stock_wh"), -f(it.get("stock_applied")))
    await db.purchases.update_one({"id": pid}, {"$set": {"voided": True, "voided_by": user["name"], "voided_at": now_iso()}})
    return {"ok": True}
