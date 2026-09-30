import csv
import io
import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from core import db, uid, now_iso, today, get_user, require_admin, is_admin, NO_ID
from services import f

router = APIRouter(prefix="/api")
BACKUP_COLLECTIONS = ["settings", "warehouses", "categories", "suppliers", "products", "customers", "sales",
                      "purchases", "stock_transfers", "expenses", "users", "counters"]


def date_q(date_from, date_to, field="date"):
    rng = {**({"$gte": date_from} if date_from else {}), **({"$lte": date_to} if date_to else {})}
    return {field: rng} if rng else {}


@router.get("/dashboard")
async def dashboard(user=Depends(get_user)):
    t, month = today(), today()[:7]
    sales = await db.sales.find({"voided": {"$ne": True}, "date": {"$gte": today(-30)}}, NO_ID).to_list(5000)
    day = [s for s in sales if s["date"] == t]
    mon = [s for s in sales if s["date"].startswith(month)]
    products = await db.products.find({}, NO_ID).to_list(5000)
    low = [{"id": p["id"], "name": p["name"], "unit": p.get("unit"), "stock": p.get("stock", {}),
            "total": sum(f(v) for v in p.get("stock", {}).values()), "min_stock": f(p.get("min_stock"))}
           for p in products if sum(f(v) for v in p.get("stock", {}).values()) <= f(p.get("min_stock"))]
    open_sales = await db.sales.find({"voided": {"$ne": True}, "balance": {"$gt": 0}}, NO_ID).to_list(5000)
    due = [s for s in open_sales if s.get("due_date") and s["due_date"] <= today(3)]
    trend = defaultdict(float)
    for s in sales:
        if s["date"] >= today(-6):
            trend[s["date"]] += s["grand_total"]
    deliveries = await db.sales.find({"voided": {"$ne": True}, "order_status": {"$ne": "close"},
                                      "delivery_date": {"$gte": t, "$lte": today(1)}}, NO_ID).to_list(200)
    res = {
        "today": {"omzet": sum(s["grand_total"] for s in day), "count": len(day),
                  "cash_in": sum(f(p["amount"]) for s in await db.sales.find({"voided": {"$ne": True}, "payments.date": t}, NO_ID).to_list(5000) for p in s["payments"] if p["date"] == t)},
        "month": {"omzet": sum(s["grand_total"] for s in mon), "count": len(mon)},
        "low_stock": low[:30],
        "receivables_total": sum(s["balance"] for s in open_sales),
        "due_soon": [{"id": s["id"], "invoice_no": s["invoice_no"], "customer": s["customer"]["name"],
                      "due_date": s["due_date"], "balance": s["balance"]} for s in due],
        "pending_indent": await db.sales.count_documents({"voided": {"$ne": True}, "order_status": "indent"}),
        "deliveries": [{"id": s["id"], "invoice_no": s["invoice_no"], "customer": s["customer"]["name"],
                        "delivery_date": s["delivery_date"], "order_status": s["order_status"],
                        "address": s.get("delivery_address")} for s in deliveries],
        "trend": [{"date": today(-i), "omzet": trend.get(today(-i), 0)} for i in range(6, -1, -1)],
    }
    if is_admin(user):
        res["today"]["profit"] = sum(s["total_material"] + s["total_bend"] - s["hpp_total"] for s in day)
        res["month"]["profit"] = sum(s["total_material"] + s["total_bend"] - s["hpp_total"] for s in mon)
        res["pending_credit"] = [{"id": s["id"], "invoice_no": s["invoice_no"], "customer": s["customer"]["name"],
                                  "balance": s["balance"], "due_date": s.get("due_date"), "cashier": s.get("cashier")}
                                 for s in open_sales if not s.get("credit_approved")]
        pos = await db.purchases.find({"voided": {"$ne": True}, "debt": {"$gt": 0}}, NO_ID).to_list(2000)
        res["payables_total"] = sum(p["debt"] for p in pos)
    return res


@router.get("/reports/pnl")
async def pnl(group: str = "day", date_from: str = "", date_to: str = "", _=Depends(require_admin)):
    cut = {"day": 10, "month": 7, "year": 4}.get(group, 10)
    rows = defaultdict(lambda: defaultdict(float))
    for s in await db.sales.find({"voided": {"$ne": True}, **date_q(date_from, date_to)}, NO_ID).to_list(20000):
        r = rows[s["date"][:cut]]
        r["material"] += s["total_material"]
        r["bend"] += s["total_bend"]
        r["ongkir"] += s["ongkir"]
        r["hpp"] += s["hpp_total"]
        r["count"] += 1
    for e in await db.expenses.find(date_q(date_from, date_to), NO_ID).to_list(20000):
        rows[e["date"][:cut]]["expenses"] += f(e["amount"])
    out, tot = [], defaultdict(float)
    for period in sorted(rows):
        r = rows[period]
        r["revenue"] = r["material"] + r["bend"]
        r["gross"] = r["revenue"] - r["hpp"]
        r["net"] = r["gross"] + r["ongkir"] - r["expenses"]
        r["margin_pct"] = round(r["gross"] / r["revenue"] * 100, 1) if r["revenue"] else 0
        out.append({"period": period, **r})
        for k, v in r.items():
            if k != "margin_pct":
                tot[k] += v
    tot["margin_pct"] = round(tot["gross"] / tot["revenue"] * 100, 1) if tot.get("revenue") else 0
    return {"rows": out, "total": tot}


@router.get("/reports/top-products")
async def top_products(date_from: str = "", date_to: str = "", _=Depends(require_admin)):
    agg = defaultdict(lambda: defaultdict(float))
    for s in await db.sales.find({"voided": {"$ne": True}, **date_q(date_from, date_to)}, NO_ID).to_list(20000):
        for i in s["items"]:
            key = i.get("category_name") or i["name"]
            a = agg[key]
            a["revenue"] += i["line_total"]
            a["hpp"] += i.get("hpp_total", 0)
            a["qty"] += f(i["qty"])
            a["meter"] += f(i.get("total_meter"))
    rows = [{"name": k, **v, "profit": v["revenue"] - v["hpp"]} for k, v in agg.items()]
    return sorted(rows, key=lambda r: r["profit"], reverse=True)


@router.get("/reports/stock")
async def stock_report(_=Depends(require_admin)):
    products = await db.products.find({}, NO_ID).sort("category_name", 1).to_list(5000)
    rows = []
    for p in products:
        st = {w: f(v) for w, v in p.get("stock", {}).items()}
        total = sum(st.values())
        unit_len = f(p.get("length")) if p.get("is_length") else 1
        rows.append({"id": p["id"], "name": p["name"], "category_name": p.get("category_name"), "unit": p.get("unit"),
                     "stock": st, "total": total, "hpp": f(p.get("hpp")), "stock_value": round(total * unit_len * f(p.get("hpp")))})
    reserved = []
    for s in await db.sales.find({"voided": {"$ne": True}, "items.indent_received": True}, NO_ID).to_list(5000):
        for i in s["items"]:
            left = f(i["qty"]) - f(i.get("delivered_qty"))
            if i.get("indent_received") and left > 0:
                reserved.append({"invoice_no": s["invoice_no"], "customer": s["customer"]["name"], "name": i["name"],
                                 "qty": left, "unit": i.get("unit"), "length": i.get("length"), "warehouse": i.get("warehouse")})
    return {"rows": rows, "reserved": reserved, "total_value": sum(r["stock_value"] for r in rows)}


@router.get("/reports/receivables")
async def receivables(_=Depends(require_admin)):
    sales = await db.sales.find({"voided": {"$ne": True}, "balance": {"$gt": 0}}, NO_ID).sort("due_date", 1).to_list(5000)
    t = today()
    return [{"id": s["id"], "invoice_no": s["invoice_no"], "date": s["date"], "customer": s["customer"]["name"],
             "phone": s["customer"].get("phone"), "grand_total": s["grand_total"], "paid_total": s["paid_total"],
             "balance": s["balance"], "due_date": s.get("due_date"), "credit_approved": s.get("credit_approved"),
             "overdue": bool(s.get("due_date") and s["due_date"] < t)} for s in sales]


@router.get("/expenses")
async def list_expenses(_=Depends(require_admin)):
    return await db.expenses.find({}, NO_ID).sort("date", -1).to_list(5000)


@router.post("/expenses")
async def add_expense(body: dict, user=Depends(require_admin)):
    doc = {"id": uid(), "date": body.get("date") or today(), "name": body.get("name", ""),
           "category": body.get("category", "Operasional"), "amount": f(body.get("amount")), "by": user["name"],
           "created_at": now_iso()}
    await db.expenses.insert_one(dict(doc))
    return doc


@router.put("/expenses/{eid}")
async def edit_expense(eid: str, body: dict, _=Depends(require_admin)):
    upd = {k: body[k] for k in ("date", "name", "category") if k in body}
    if "amount" in body:
        upd["amount"] = f(body["amount"])
    await db.expenses.update_one({"id": eid}, {"$set": upd})
    return await db.expenses.find_one({"id": eid}, NO_ID)


@router.delete("/expenses/{eid}")
async def del_expense(eid: str, _=Depends(require_admin)):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}


@router.get("/backup/export")
async def export_json(_=Depends(require_admin)):
    data = {c: await db[c].find({}, {"_id": 0} if c != "counters" else {}).to_list(100000) for c in BACKUP_COLLECTIONS}
    payload = json.dumps({"app": "HORAS BAJA POS", "exported_at": now_iso(), "data": data}, default=str)
    return StreamingResponse(io.BytesIO(payload.encode()), media_type="application/json",
                             headers={"Content-Disposition": f"attachment; filename=horasbaja-backup-{today()}.json"})


@router.get("/backup/csv/{collection}")
async def export_csv(collection: str, _=Depends(require_admin)):
    if collection not in BACKUP_COLLECTIONS or collection == "users":
        raise HTTPException(400, "Koleksi tidak valid")
    docs = await db[collection].find({}, NO_ID).to_list(100000)
    keys = sorted({k for d in docs for k in d.keys()})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(keys)
    for d in docs:
        w.writerow([json.dumps(d.get(k), default=str) if isinstance(d.get(k), (dict, list)) else d.get(k, "") for k in keys])
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8-sig")), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={collection}-{today()}.csv"})


@router.post("/backup/import")
async def import_json(body: dict, _=Depends(require_admin)):
    data = body.get("data") or {}
    restored = {}
    for c in BACKUP_COLLECTIONS:
        if c in data and isinstance(data[c], list):
            await db[c].delete_many({})
            if data[c]:
                await db[c].insert_many(data[c])
            restored[c] = len(data[c])
    return {"restored": restored}
