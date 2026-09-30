from collections import defaultdict

from fastapi import HTTPException

from core import db, uid, now_iso, today, po_number, NO_ID

STATUS_LABELS = {"indent": "Proses Indent", "ready": "Ready / Belum Dikirim",
                 "partial": "Antar Sebagian", "close": "Close (Selesai)"}
RECEIVE_STATUSES = ["Dalam Proses", "Barang Diterima", "Barang Belum Lengkap", "Barang Direject Semua"]


def f(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def calc_line(it: dict) -> dict:
    qty, price = f(it.get("qty")), f(it.get("price"))
    if it.get("is_length"):
        it["total_meter"] = round(qty * f(it.get("length")), 2)
        it["subtotal"] = round(it["total_meter"] * price)
        it["bend_subtotal"] = round(qty * f(it.get("bend_fee"))) if it.get("bend") == "lengkung" else 0
        it["hpp_total"] = round(it["total_meter"] * f(it.get("hpp_unit")))
    else:
        ratio = f(it.get("ratio")) or 1
        it["total_meter"] = 0
        it["subtotal"] = round(qty * price)
        it["bend_subtotal"] = 0
        it["hpp_total"] = round(qty * ratio * f(it.get("hpp_unit")))
    it["line_total"] = it["subtotal"] + it["bend_subtotal"]
    it.setdefault("line_id", uid())
    it.setdefault("delivered_qty", 0)
    return it


def calc_po_item(it: dict) -> dict:
    qty = f(it.get("qty"))
    it["total_meter"] = round(qty * f(it.get("length")), 2) if it.get("is_length") else 0
    base = it["total_meter"] if it.get("is_length") else qty * (f(it.get("ratio")) or 1)
    it["subtotal"] = round(base * f(it.get("hpp_unit")))
    it.setdefault("line_id", uid())
    it.setdefault("received_qty", 0)
    it.setdefault("stock_applied", 0)
    return it


def po_totals(po: dict) -> dict:
    items_total = sum(i["subtotal"] for i in po["items"])
    po["items_total"] = items_total
    po["total"] = po["total_manual"] if po.get("total_manual") not in (None, "") else items_total
    po["paid_amount"] = f(po.get("paid_amount"))
    if po.get("paid_status") == "Lunas":
        po["paid_amount"] = po["total"]
    po["debt"] = max(po["total"] - po["paid_amount"], 0)
    return po


def compute_status(sale: dict) -> str:
    items = sale.get("items", [])
    if items and all(f(i.get("delivered_qty")) >= f(i["qty"]) for i in items):
        return "close"
    if any(f(i.get("delivered_qty")) > 0 for i in items):
        return "partial"
    if any(i.get("mode") == "indent" and not i.get("indent_received") for i in items):
        return "indent"
    return "ready"


def sale_totals(sale: dict) -> dict:
    items = sale["items"]
    sale["total_material"] = sum(i["subtotal"] for i in items)
    sale["total_bend"] = sum(i["bend_subtotal"] for i in items)
    sale["ongkir"] = f(sale.get("ongkir"))
    sale["grand_total"] = sale["total_material"] + sale["total_bend"] + sale["ongkir"]
    sale["hpp_total"] = sum(i.get("hpp_total", 0) for i in items)
    sale["paid_total"] = sum(f(p["amount"]) for p in sale.get("payments", []))
    sale["balance"] = max(sale["grand_total"] - sale["paid_total"], 0)
    if sale["balance"] <= 0:
        sale["payment_status"] = "Lunas"
    elif sale["paid_total"] > 0:
        sale["payment_status"] = "DP"
    else:
        sale["payment_status"] = "Piutang"
    return sale


async def prep_line(raw: dict, old_lines: dict) -> dict:
    it = {k: v for k, v in raw.items() if k not in ("hpp_unit", "hpp_total")}
    old = old_lines.get(it.get("line_id")) if it.get("line_id") else None
    if old:
        for k in ("hpp_unit", "po_id", "po_no", "indent_received", "delivered_qty"):
            if k in old:
                it[k] = old[k]
    else:
        it.pop("line_id", None)
        it["delivered_qty"] = 0
        it["hpp_unit"] = 0
        if it.get("product_id"):
            p = await db.products.find_one({"id": it["product_id"]}, NO_ID)
            if p:
                it["hpp_unit"] = f(p.get("hpp"))
                it.setdefault("category_name", p.get("category_name"))
    it["mode"] = it.get("mode") or "ready"
    it["qty"] = f(it.get("qty"))
    if it["qty"] <= 0:
        raise HTTPException(400, f"Qty item {it.get('name')} harus > 0")
    return calc_line(it)


async def adjust_stock(product_id, wh, delta):
    if product_id and wh and delta:
        await db.products.update_one({"id": product_id}, {"$inc": {f"stock.{wh}": round(delta, 3)}})


def stock_units(it):
    return f(it["qty"]) * (f(it.get("ratio")) or 1)


def po_item_from_line(line: dict) -> dict:
    keys = ("product_id", "name", "category_name", "is_length", "length", "qty", "unit", "bend",
            "brand", "thickness", "color", "hpp_unit", "ratio")
    it = {k: line.get(k) for k in keys}
    it["sale_line_id"] = line["line_id"]
    return calc_po_item(it)


async def create_indent_pos(sale: dict, lines: list):
    groups = defaultdict(list)
    for ln in lines:
        groups[ln.get("supplier_id")].append(ln)
    for sid, ls in groups.items():
        sup = await db.suppliers.find_one({"id": sid}, NO_ID) or {"id": sid, "name": "Tanpa Supplier", "prefix": "GEN"}
        po = {"id": uid(), "po_no": await po_number(sup["prefix"]), "type": "indent",
              "supplier_id": sup["id"], "supplier_name": sup["name"], "date": sale.get("date") or today(),
              "warehouse": "G1", "sale_id": sale["id"], "invoice_no": sale["invoice_no"],
              "customer_name": sale["customer"].get("name"), "delivery_date": sale.get("delivery_date"),
              "items": [po_item_from_line(ln) for ln in ls], "receive_status": "Draft",
              "paid_status": "Belum Bayar", "paid_amount": 0, "status_log": [], "voided": False,
              "notes": f"Auto PO Indent dari nota {sale['invoice_no']}", "created_at": now_iso()}
        po_totals(po)
        await db.purchases.insert_one(dict(po))
        for ln in ls:
            ln["po_id"], ln["po_no"] = po["id"], po["po_no"]


async def sync_indent_pos(sale: dict, removed_lines: list):
    for ln in removed_lines:
        if ln.get("po_id"):
            await db.purchases.update_one({"id": ln["po_id"]}, {"$pull": {"items": {"sale_line_id": ln["line_id"]}}})
    po_ids = {ln["po_id"] for ln in sale["items"] if ln.get("po_id")} | {ln["po_id"] for ln in removed_lines if ln.get("po_id")}
    lines = {ln["line_id"]: ln for ln in sale["items"]}
    for pid in po_ids:
        po = await db.purchases.find_one({"id": pid}, NO_ID)
        if not po:
            continue
        for it in po["items"]:
            ln = lines.get(it.get("sale_line_id"))
            if ln:
                for k in ("name", "is_length", "length", "qty", "unit", "bend", "brand", "thickness", "color"):
                    it[k] = ln.get(k)
                calc_po_item(it)
        po["delivery_date"] = sale.get("delivery_date")
        if not po["items"]:
            po["voided"] = True
        po_totals(po)
        await db.purchases.replace_one({"id": pid}, po)


async def refresh_sale_status(sale_id: str):
    sale = await db.sales.find_one({"id": sale_id}, NO_ID)
    if sale and not sale.get("voided"):
        await db.sales.update_one({"id": sale_id}, {"$set": {"order_status": compute_status(sale)}})
