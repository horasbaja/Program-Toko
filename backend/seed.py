import os
import logging

from core import db, uid, now_iso, today, hash_password, verify_password

log = logging.getLogger("seed")

CATEGORIES = [
    ("Seng Deck (Spandek)", True, "Lembar"), ("Kanal C Baja Ringan", False, "Batang"),
    ("Reng Baja Ringan", False, "Batang"), ("Atap Alderon", True, "Lembar"), ("Acrylic", False, "Lembar"),
    ("Plafon PVC", True, "Batang"), ("Talang Air", False, "Batang"), ("Baut/Sekrup Roofing", False, "Bungkus"),
    ("Furing", False, "Batang"), ("Lisplang", False, "Batang"), ("Cement Board", False, "Lembar"),
    ("ACP", False, "Lembar"), ("Canopy Polycarbonate", False, "Meter"),
]

SUPPLIERS = [
    {"name": "PT CMC (Cahaya Murni Cemerlang)", "prefix": "CMC", "sales_contact": "Rudi (Sales)", "phone": "081260001122", "address": "KIM II Mabar, Medan"},
    {"name": "PT Deli Makmur Steel", "prefix": "DMS", "sales_contact": "Hendra (Sales)", "phone": "081370002233", "address": "Jl. Yos Sudarso, Medan"},
    {"name": "CV Sinar Plafon Sumatera", "prefix": "SPS", "sales_contact": "Lina", "phone": "082160003344", "address": "Jl. Sisingamangaraja, Medan"},
]

# name, category idx, supplier idx, brand, thick, color, price, bend_fee, hpp, length, G1, G2, min, alt_units
PRODUCTS = [
    ("Seng Spandek CMC 0.30 Biru 6m", 0, 0, "CMC", "0.30", "Biru", 58000, 15000, 46000, 6, 120, 80, 30, []),
    ("Seng Spandek DMS 0.35 Merah 6m", 0, 1, "DMS", "0.35", "Merah", 65000, 15000, 52000, 6, 60, 40, 20, []),
    ("Seng Spandek Pasir CMC 0.30 Hijau 4m", 0, 0, "CMC", "0.30", "Hijau", 55000, 15000, 44000, 4, 50, 10, 15, []),
    ("Atap Alderon Twinwall Putih 6m", 3, 1, "Alderon", "10mm", "Putih", 145000, 25000, 118000, 6, 30, 20, 10, []),
    ("Plafon PVC Motif Kayu 4m", 5, 2, "Shunda", "8mm", "Kayu Jati", 32000, 0, 24000, 4, 200, 150, 50, []),
    ("Kanal C 75 x 0.75 6m", 1, 0, "CMC", "0.75", "Zincalume", 98000, 0, 82000, 0, 300, 200, 50, []),
    ("Reng 30 x 0.45 6m", 2, 0, "CMC", "0.45", "Zincalume", 48000, 0, 39000, 0, 400, 250, 80, []),
    ("Acrylic Bening 2mm 1.22x2.44", 4, 2, "Marga Cipta", "2mm", "Bening", 385000, 0, 320000, 0, 3, 1, 5, []),
    ("Talang Air PVC 4 inch", 6, 2, "Rucika", "4\"", "Abu", 125000, 0, 98000, 0, 40, 25, 10, []),
    ("Baut Roofing 12x50", 7, 1, "Hitachi", "12x50", "Silver", 25000, 0, 19000, 0, 150, 90, 30,
     [{"unit": "Kotak", "ratio": 10, "price": 230000}]),
    ("Furing Hollow 2x4", 8, 0, "CMC", "0.30", "Galvalum", 42000, 0, 33000, 0, 250, 120, 40, []),
    ("Lisplang GRC 20cm", 9, 2, "Kalsi", "8mm", "Abu", 68000, 0, 52000, 0, 80, 60, 20, []),
    ("Cement Board 8mm 1.22x2.44", 10, 2, "Kalsi", "8mm", "Abu", 175000, 0, 140000, 0, 45, 30, 10, []),
    ("ACP Seven 3mm Silver", 11, 2, "Seven", "3mm", "Silver", 450000, 0, 365000, 0, 12, 4, 5, []),
    ("Polycarbonate Solarflat 1.22", 12, 2, "Solarflat", "3mm", "Bening", 95000, 0, 72000, 0, 150, 75, 25,
     [{"unit": "Roll", "ratio": 25, "price": 2250000}]),
]

CUSTOMERS = [
    ("Pak Budi Sitorus", "Kontraktor", "VVIP", "081265551234", "Jl. Sutomo No. 12, Pematang Siantar"),
    ("CV Siantar Jaya Konstruksi", "Kontraktor", "R", "085277761212", "Jl. Merdeka No. 88, Pematang Siantar"),
    ("Andi Simanjuntak (Tukang)", "Tukang", "N", "082166609876", "Jl. Kartini Gg. Damai, Siantar Barat"),
    ("Ibu Rosmawati Damanik", "Umum", "N", "081375554321", "Jl. Sang Naualuh No. 40, Siantar"),
    ("Pak Hotman Sinaga", "Tukang", "R", "085361112233", "Jl. Medan Km 5, Siantar Martoba"),
    ("Toko Bangunan Rajawali", "Kontraktor", "VVIP", "0622-21234", "Jl. Diponegoro No. 5, Tebing Tinggi"),
]


async def seed_users():
    for uname, pw, name, role in (
        (os.environ["ADMIN_USERNAME"], os.environ["ADMIN_PASSWORD"], "Pemilik HORAS BAJA", "admin"),
        (os.environ["KASIR_USERNAME"], os.environ["KASIR_PASSWORD"], "Kasir Toko", "kasir"),
    ):
        ex = await db.users.find_one({"username": uname})
        if not ex:
            await db.users.insert_one({"id": uid(), "username": uname, "name": name, "role": role, "active": True,
                                       "password_hash": hash_password(pw), "created_at": now_iso()})
        elif not verify_password(pw, ex["password_hash"]):
            await db.users.update_one({"username": uname}, {"$set": {"password_hash": hash_password(pw)}})


def ready(p, qty, wh, bend="lurus", alt=None):
    line = {"mode": "ready", "product_id": p["id"], "name": p["name"], "category_name": p["category_name"],
            "is_length": p["is_length"], "unit": p["unit"], "qty": qty, "length": p.get("length"),
            "price": p["price"], "bend_fee": p.get("bend_fee", 0), "bend": bend, "warehouse": wh, "ratio": 1,
            "supplier_id": p.get("supplier_id")}
    if alt:
        line.update({"unit": alt["unit"], "ratio": alt["ratio"], "price": alt["price"]})
    return line


def indent(p, sup, thick, color, length, qty, bend, price=None):
    return {"mode": "indent", "product_id": p["id"], "supplier_id": sup["id"], "brand": sup["prefix"],
            "thickness": thick, "color": color, "name": f"{p['category_name']} {sup['prefix']} {thick} {color}",
            "category_name": p["category_name"], "is_length": True, "unit": p["unit"], "qty": qty, "length": length,
            "price": price or p["price"], "bend_fee": p.get("bend_fee", 0), "bend": bend, "ratio": 1}


async def migrate_products():
    async for p in db.products.find({"is_lengkung": {"$exists": False}}, {"_id": 0, "id": 1, "bend_fee": 1}):
        fee = float(p.get("bend_fee") or 0)
        await db.products.update_one({"id": p["id"]}, {"$set": {"is_lengkung": fee > 0, "upah_lengkung": fee}})


async def seed_all():
    await seed_users()
    if await db.settings.find_one({"id": "store"}) is None:
        await db.settings.insert_one({"id": "store", "name": "HORAS BAJA", "tagline": "Spesialis Seng, Roofing & Material Konstruksi",
                                      "address": "Jln Ade Irma Suryani No 68, Pematang Siantar", "phone": "062222452",
                                      "wa1": "085261288220", "wa2": "085360184080",
                                      "footer": "Terima kasih atas kepercayaan Anda. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan."})
    if await db.warehouses.count_documents({}) == 0:
        await db.warehouses.insert_many([
            {"id": uid(), "code": "G1", "name": "Gudang Mojopahit", "address": "Jalan Mojopahit, Pematang Siantar"},
            {"id": uid(), "code": "G2", "name": "Gudang Wahidin", "address": "Jalan Wahidin, Pematang Siantar"}])
    if await db.products.count_documents({}) > 0:
        return
    log.info("Seeding HORAS BAJA dummy data")
    cats = [{"id": uid(), "name": n, "is_length": il, "unit": u, "created_at": now_iso()} for n, il, u in CATEGORIES]
    await db.categories.insert_many([dict(c) for c in cats])
    sups = [{"id": uid(), **s, "created_at": now_iso()} for s in SUPPLIERS]
    await db.suppliers.insert_many([dict(s) for s in sups])
    prods = []
    for (name, ci, si, brand, th, col, price, bend, hpp, length, g1, g2, mn, alts) in PRODUCTS:
        c = cats[ci]
        prods.append({"id": uid(), "name": name, "category_id": c["id"], "category_name": c["name"], "supplier_id": sups[si]["id"],
                      "brand": brand, "thickness": th, "color": col, "unit": c["unit"], "is_length": c["is_length"],
                      "length": length, "price": price, "bend_fee": bend, "hpp": hpp, "stock": {"G1": g1, "G2": g2},
                      "min_stock": mn, "alt_units": alts, "created_at": now_iso()})
    await db.products.insert_many([dict(p) for p in prods])
    custs = [{"id": uid(), "name": n, "type": t, "status": s, "phone": ph, "address": a, "created_at": now_iso()}
             for n, t, s, ph, a in CUSTOMERS]
    await db.customers.insert_many([dict(c) for c in custs])
    await seed_transactions(prods, sups, custs)


async def seed_transactions(P, S, C):
    from routes_sales import create_sale, add_delivery
    from routes_purchases import create_po, receive_po
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "password_hash": 0})
    kasir = await db.users.find_one({"role": "kasir"}, {"_id": 0, "password_hash": 0})

    def cust(c):
        return {k: c[k] for k in ("id", "name", "phone", "address", "type", "status")}

    s1 = await create_sale({"customer": cust(C[0]), "items": [ready(P[0], 20, "G1", "lengkung"), ready(P[5], 30, "G1"),
                           ready(P[9], 2, "G1", alt=P[9]["alt_units"][0])], "ongkir": 150000, "payment_method": "Tunai",
                           "delivery_date": today(-4), "notes": "Kirim sebelum jam 12 siang"}, kasir, today(-5))
    await add_delivery(s1["id"], {"date": today(-4), "warehouse": "G1",
                                  "items": [{"line_id": i["line_id"], "qty": i["qty"]} for i in s1["items"]]}, kasir)

    s2 = await create_sale({"customer": cust(C[1]), "items": [indent(P[0], S[0], "0.35", "Biru Pasir", 7.5, 28, "lengkung", 62000),
                           ready(P[6], 50, "G2")], "ongkir": 250000, "payment_method": "DP", "dp_amount": 5000000,
                           "due_date": today(14), "delivery_date": today(3), "notes": "Titip ke mandor Pak Rahmat di lokasi proyek"},
                           kasir, today(-3))

    s3 = await create_sale({"customer": cust(C[2]), "items": [ready(P[4], 40, "G2"), ready(P[10], 30, "G2")],
                            "ongkir": 50000, "payment_method": "Piutang", "due_date": today(1), "delivery_date": today(-1),
                            "notes": "Titip ke tukang Budi"}, kasir, today(-2))
    await add_delivery(s3["id"], {"date": today(-1), "warehouse": "G2",
                                  "items": [{"line_id": s3["items"][0]["line_id"], "qty": 20}]}, kasir)

    await create_sale({"customer": cust(C[3]), "items": [ready(P[7], 2, "G1"), ready(P[14], 1, "G1", alt=P[14]["alt_units"][0])],
                       "payment_method": "Transfer", "delivery_date": today(1), "notes": ""}, kasir, today())

    s5 = await create_sale({"customer": cust(C[4]), "items": [indent(P[3], S[1], "10mm", "Putih Susu", 5.2, 14, "lurus"),
                            indent(P[1], S[1], "0.35", "Merah Marun", 6.5, 10, "lengkung")], "ongkir": 100000,
                            "payment_method": "DP", "dp_amount": 2000000, "due_date": today(10),
                            "delivery_date": today(5), "notes": "Hubungi dulu sebelum antar"}, kasir, today(-1))
    po5 = await db.purchases.find_one({"sale_id": s5["id"]}, {"_id": 0})
    await receive_po(po5["id"], {"status": "Barang Diterima", "warehouse": "G2"}, kasir)

    s6 = await create_sale({"customer": cust(C[5]), "items": [ready(P[12], 20, "G1"), ready(P[13], 5, "G1")],
                            "ongkir": 350000, "payment_method": "Piutang", "due_date": today(-2), "delivery_date": today(-9),
                            "notes": ""}, admin, today(-10))
    await add_delivery(s6["id"], {"date": today(-9), "warehouse": "G1",
                                  "items": [{"line_id": i["line_id"], "qty": i["qty"]} for i in s6["items"]]}, admin)
    await db.sales.update_one({"id": s6["id"]}, {"$set": {"credit_approved": True}})

    po = await create_po({"supplier_id": S[0]["id"], "warehouse": "G1", "paid_status": "Belum Bayar", "notes": "Restock rutin",
                          "items": [{"product_id": P[0]["id"], "name": P[0]["name"], "category_name": P[0]["category_name"],
                                     "is_length": True, "length": 6, "qty": 100, "unit": "Lembar", "bend": "lurus", "hpp_unit": 46000},
                                    {"product_id": P[5]["id"], "name": P[5]["name"], "category_name": P[5]["category_name"],
                                     "is_length": False, "qty": 150, "unit": "Batang", "hpp_unit": 82000}]}, admin)
    await receive_po(po["id"], {"status": "Dalam Proses", "warehouse": "G1"}, kasir)
    for d, n, cat, amt in ((today(-5), "Gaji harian kuli angkut", "Gaji", 450000), (today(-3), "Solar truk antar", "Transportasi", 350000),
                           (today(-1), "Listrik & air toko", "Utilitas", 1250000), (today(), "Konsumsi karyawan", "Operasional", 150000)):
        await db.expenses.insert_one({"id": uid(), "date": d, "name": n, "category": cat, "amount": amt, "by": "seed", "created_at": now_iso()})
    log.info("Seed complete")
