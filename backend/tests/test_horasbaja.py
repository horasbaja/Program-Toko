"""HORAS BAJA POS backend E2E API tests (pytest)."""
import os
import io
import json
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE = BASE.rstrip("/")
API = f"{BASE}/api"


def login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200, f"login failed {u}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {login('admin', 'admin123')}"}


@pytest.fixture(scope="module")
def kasir_h():
    return {"Authorization": f"Bearer {login('kasir', 'kasir123')}"}


# ---------- Auth & role ----------
def test_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200


def test_login_bad():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_me(admin_h, kasir_h):
    assert requests.get(f"{API}/auth/me", headers=admin_h).json()["role"] == "admin"
    assert requests.get(f"{API}/auth/me", headers=kasir_h).json()["role"] == "kasir"


def test_kasir_forbidden_reports(kasir_h):
    r = requests.get(f"{API}/reports/pnl", headers=kasir_h)
    assert r.status_code == 403


def test_kasir_forbidden_users(kasir_h):
    assert requests.get(f"{API}/users", headers=kasir_h).status_code == 403


# ---------- Bootstrap & HPP stripping ----------
def test_kasir_products_strip_hpp(kasir_h, admin_h):
    kp = requests.get(f"{API}/products", headers=kasir_h).json()
    ap = requests.get(f"{API}/products", headers=admin_h).json()
    assert len(kp) > 0
    assert all("hpp" not in p for p in kp), "Kasir must not see hpp"
    assert any("hpp" in p for p in ap), "Admin must see hpp"


def test_kasir_suppliers_masked(kasir_h, admin_h):
    ks = requests.get(f"{API}/suppliers", headers=kasir_h).json()
    ads = requests.get(f"{API}/suppliers", headers=admin_h).json()
    assert all(set(s.keys()) <= {"id", "name", "prefix"} for s in ks)
    assert any("phone" in s for s in ads)


def test_bootstrap(admin_h):
    r = requests.get(f"{API}/bootstrap", headers=admin_h).json()
    for k in ("settings", "warehouses", "categories", "suppliers", "products", "customers"):
        assert k in r
    assert len(r["products"]) >= 15


# ---------- Sales list strip ----------
def test_kasir_sales_no_hpp(kasir_h):
    r = requests.get(f"{API}/sales", headers=kasir_h).json()
    assert "items" in r and len(r["items"]) >= 1
    for s in r["items"]:
        for it in s.get("items", []):
            assert "hpp_unit" not in it and "hpp_total" not in it
        assert "hpp_total" not in s


def test_kasir_purchases_no_money(kasir_h):
    r = requests.get(f"{API}/purchases", headers=kasir_h).json()
    for p in r["items"]:
        for k in ("total", "subtotal", "paid_amount", "debt"):
            assert k not in p, f"purchases leaked {k}"
        for it in p.get("items", []):
            assert "hpp_unit" not in it


# ---------- POS Sale creation (ready + indent) ----------
@pytest.fixture(scope="module")
def bootstrap_data(admin_h):
    return requests.get(f"{API}/bootstrap", headers=admin_h).json()


def _find_product(products, name_contains):
    for p in products:
        if name_contains.lower() in p["name"].lower():
            return p
    return None


def test_pos_ready_sale_decreases_stock(kasir_h, bootstrap_data):
    seng = _find_product(bootstrap_data["products"], "Seng Spandek CMC 0.30 Biru")
    assert seng
    before = requests.get(f"{API}/bootstrap", headers=kasir_h).json()
    seng_before = _find_product(before["products"], "Seng Spandek CMC 0.30 Biru")
    g1_before = seng_before["stock"]["G1"]
    payload = {
        "customer": {"name": "TEST_Budi"},
        "save_customer": True,
        "items": [{"mode": "ready", "product_id": seng["id"], "name": seng["name"],
                   "category_name": seng["category_name"], "is_length": True, "unit": "Lembar",
                   "qty": 3, "length": 6, "price": 58000, "bend_fee": 15000, "bend": "lengkung",
                   "warehouse": "G1", "ratio": 1}],
        "ongkir": 50000, "payment_method": "Tunai",
        "delivery_date": "2026-01-20", "notes": "TEST ready"
    }
    r = requests.post(f"{API}/sales", headers=kasir_h, json=payload)
    assert r.status_code == 200, r.text
    sale = r.json()
    # expected total: material 3*6*58000=1044000 + bend 3*15000=45000 + ongkir 50000 = 1139000
    assert sale["grand_total"] == 1139000
    assert sale["balance"] == 0
    # order_status depends on delivered_qty; Tunai payment doesn't auto-deliver
    assert sale["order_status"] in ("ready", "close")
    # stock decreased
    after = requests.get(f"{API}/bootstrap", headers=kasir_h).json()
    seng_after = _find_product(after["products"], "Seng Spandek CMC 0.30 Biru")
    assert abs(seng_after["stock"]["G1"] - (g1_before - 3)) < 0.01
    # kasir view has no hpp
    d = requests.get(f"{API}/sales/{sale['id']}", headers=kasir_h).json()
    assert "hpp_total" not in d


def test_pos_indent_creates_auto_po(kasir_h, admin_h, bootstrap_data):
    seng = _find_product(bootstrap_data["products"], "Seng Spandek CMC")
    sup = next(s for s in bootstrap_data["suppliers"] if s["prefix"] == "CMC")
    payload = {
        "customer": {"name": "TEST_CV_Indent"}, "save_customer": True,
        "items": [{"mode": "indent", "product_id": seng["id"], "supplier_id": sup["id"],
                   "brand": "CMC", "thickness": "0.35", "color": "Biru Pasir",
                   "name": "Seng Deck (Spandek) CMC 0.35 Biru Pasir",
                   "category_name": "Seng Deck (Spandek)", "is_length": True, "unit": "Lembar",
                   "qty": 28, "length": 7.5, "price": 62000, "bend_fee": 15000, "bend": "lengkung", "ratio": 1}],
        "ongkir": 250000, "payment_method": "DP", "dp_amount": 5000000,
        "delivery_date": "2026-01-25", "due_date": "2026-02-05"
    }
    r = requests.post(f"{API}/sales", headers=kasir_h, json=payload)
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["order_status"] == "indent"
    assert sale["balance"] > 0
    # PO auto created (admin view)
    pos = requests.get(f"{API}/purchases", headers=admin_h, params={"type": "indent"}).json()["items"]
    linked = [p for p in pos if p.get("sale_id") == sale["id"]]
    assert len(linked) == 1
    po = linked[0]
    assert po["po_no"].startswith("CMC26") and len(po["po_no"]) == 9
    assert po["items"][0]["qty"] == 28
    assert po["items"][0]["length"] == 7.5
    assert po["items"][0]["bend"] == "lengkung"
    assert po["items"][0]["unit"] == "Lembar"
    return sale, po


# ---------- Delivery / Surat Jalan ----------
def test_add_delivery_partial(admin_h, bootstrap_data):
    # create a fresh ready sale as admin
    prod = _find_product(bootstrap_data["products"], "Reng 30")
    payload = {"customer": {"name": "TEST_SJ"}, "items": [
        {"mode": "ready", "product_id": prod["id"], "name": prod["name"],
         "category_name": prod["category_name"], "is_length": False, "unit": "Batang",
         "qty": 10, "price": 48000, "bend": "lurus", "warehouse": "G1", "ratio": 1}],
        "payment_method": "Tunai"}
    sale = requests.post(f"{API}/sales", headers=admin_h, json=payload).json()
    ln = sale["items"][0]
    r = requests.post(f"{API}/sales/{sale['id']}/deliveries", headers=admin_h,
                      json={"warehouse": "G1", "items": [{"line_id": ln["line_id"], "qty": 4}]})
    assert r.status_code == 200, r.text
    upd = r.json()["sale"]
    assert upd["order_status"] == "partial"
    # deliver rest
    r2 = requests.post(f"{API}/sales/{sale['id']}/deliveries", headers=admin_h,
                       json={"warehouse": "G1", "items": [{"line_id": ln["line_id"], "qty": 6}]})
    assert r2.json()["sale"]["order_status"] == "close"


# ---------- Payment ----------
def test_add_payment_reduces_balance(admin_h, bootstrap_data):
    prod = _find_product(bootstrap_data["products"], "Plafon PVC")
    sale = requests.post(f"{API}/sales", headers=admin_h, json={
        "customer": {"name": "TEST_Piutang"},
        "items": [{"mode": "ready", "product_id": prod["id"], "name": prod["name"],
                   "category_name": prod["category_name"], "is_length": True, "unit": "Batang",
                   "qty": 5, "length": 4, "price": 32000, "bend": "lurus", "warehouse": "G1", "ratio": 1}],
        "payment_method": "Piutang", "due_date": "2026-02-01"}).json()
    assert sale["balance"] > 0
    total = sale["grand_total"]
    r = requests.post(f"{API}/sales/{sale['id']}/payments", headers=admin_h,
                      json={"amount": total, "method": "Tunai"})
    assert r.status_code == 200
    assert r.json()["balance"] == 0
    assert r.json()["payment_status"] == "Lunas"


# ---------- Admin edit sale ----------
def test_admin_edit_sale_add_item(admin_h, bootstrap_data):
    p1 = _find_product(bootstrap_data["products"], "Kanal C 75")
    sale = requests.post(f"{API}/sales", headers=admin_h, json={
        "customer": {"name": "TEST_Edit"},
        "items": [{"mode": "ready", "product_id": p1["id"], "name": p1["name"],
                   "category_name": p1["category_name"], "is_length": False, "unit": "Batang",
                   "qty": 2, "price": 98000, "bend": "lurus", "warehouse": "G1", "ratio": 1}],
        "payment_method": "Tunai"}).json()
    original_total = sale["grand_total"]
    # add a second item
    new_items = list(sale["items"]) + [{"mode": "ready", "product_id": p1["id"], "name": p1["name"],
                                        "category_name": p1["category_name"], "is_length": False,
                                        "unit": "Batang", "qty": 3, "price": 98000, "bend": "lurus",
                                        "warehouse": "G1", "ratio": 1}]
    r = requests.put(f"{API}/sales/{sale['id']}", headers=admin_h, json={"items": new_items})
    assert r.status_code == 200, r.text
    assert r.json()["grand_total"] > original_total


def test_admin_void_restores_stock(admin_h, bootstrap_data):
    p = _find_product(bootstrap_data["products"], "Talang Air")
    before = requests.get(f"{API}/products", headers=admin_h).json()
    before_stock = next(x for x in before if x["id"] == p["id"])["stock"]["G1"]
    sale = requests.post(f"{API}/sales", headers=admin_h, json={
        "customer": {"name": "TEST_Void"},
        "items": [{"mode": "ready", "product_id": p["id"], "name": p["name"],
                   "category_name": p["category_name"], "is_length": False, "unit": "Batang",
                   "qty": 2, "price": p["price"], "bend": "lurus", "warehouse": "G1", "ratio": 1}],
        "payment_method": "Tunai"}).json()
    mid = requests.get(f"{API}/products", headers=admin_h).json()
    mid_stock = next(x for x in mid if x["id"] == p["id"])["stock"]["G1"]
    assert abs(mid_stock - (before_stock - 2)) < 0.01
    r = requests.post(f"{API}/sales/{sale['id']}/void", headers=admin_h, json={"reason": "test"})
    assert r.status_code == 200
    after = requests.get(f"{API}/products", headers=admin_h).json()
    after_stock = next(x for x in after if x["id"] == p["id"])["stock"]["G1"]
    assert abs(after_stock - before_stock) < 0.01


# ---------- Offline idempotency ----------
def test_offline_idempotent(kasir_h, bootstrap_data):
    p = _find_product(bootstrap_data["products"], "Baut Roofing")
    off_id = f"OFF-{int(time.time())}"
    payload = {"customer": {"name": "TEST_Offline"}, "offline_id": off_id,
               "items": [{"mode": "ready", "product_id": p["id"], "name": p["name"],
                          "category_name": p["category_name"], "is_length": False, "unit": "Bungkus",
                          "qty": 1, "price": 25000, "bend": "lurus", "warehouse": "G1", "ratio": 1}],
               "payment_method": "Tunai"}
    a = requests.post(f"{API}/sales", headers=kasir_h, json=payload).json()
    b = requests.post(f"{API}/sales", headers=kasir_h, json=payload).json()
    assert a["id"] == b["id"], "offline_id must be idempotent"


# ---------- Stock transfer ----------
def test_stock_transfer(kasir_h, bootstrap_data):
    p = _find_product(bootstrap_data["products"], "Furing")
    r = requests.post(f"{API}/stock/transfer", headers=kasir_h,
                      json={"product_id": p["id"], "from_wh": "G1", "to_wh": "G2", "qty": 5, "note": "TEST"})
    assert r.status_code == 200
    lst = requests.get(f"{API}/stock/transfers", headers=kasir_h).json()
    assert any(t.get("note") == "TEST" for t in lst)


# ---------- Manual PO create + receive ----------
def test_manual_po_create_receive(admin_h, bootstrap_data):
    p = _find_product(bootstrap_data["products"], "Cement Board")
    sup = next(s for s in bootstrap_data["suppliers"] if s["prefix"] == "SPS")
    before_stock = _find_product(
        requests.get(f"{API}/products", headers=admin_h).json(), "Cement Board")["stock"]["G2"]
    po = requests.post(f"{API}/purchases", headers=admin_h, json={
        "supplier_id": sup["id"], "warehouse": "G2", "paid_status": "Belum Bayar",
        "items": [{"product_id": p["id"], "name": p["name"], "category_name": p["category_name"],
                   "is_length": False, "qty": 5, "unit": "Lembar", "hpp_unit": 140000}]}).json()
    assert po["po_no"].startswith("SPS26")
    assert po["total"] == 700000
    # receive full
    r = requests.patch(f"{API}/purchases/{po['id']}/receive", headers=admin_h,
                       json={"status": "Barang Diterima", "warehouse": "G2"})
    assert r.status_code == 200
    after_stock = _find_product(
        requests.get(f"{API}/products", headers=admin_h).json(), "Cement Board")["stock"]["G2"]
    assert abs(after_stock - (before_stock + 5)) < 0.01


# ---------- Admin edit PO HPP override ----------
def test_admin_edit_po_total_manual(admin_h, bootstrap_data):
    p = _find_product(bootstrap_data["products"], "Lisplang")
    sup = next(s for s in bootstrap_data["suppliers"] if s["prefix"] == "SPS")
    po = requests.post(f"{API}/purchases", headers=admin_h, json={
        "supplier_id": sup["id"], "warehouse": "G1",
        "items": [{"product_id": p["id"], "name": p["name"], "category_name": p["category_name"],
                   "is_length": False, "qty": 10, "unit": "Batang", "hpp_unit": 52000}]}).json()
    assert po["total"] == 520000
    r = requests.put(f"{API}/purchases/{po['id']}", headers=admin_h,
                     json={"total_manual": 500000, "paid_amount": 200000})
    upd = r.json()
    assert upd["total"] == 500000
    assert upd["debt"] == 300000


# ---------- Reports (admin) ----------
def test_reports_pnl(admin_h):
    r = requests.get(f"{API}/reports/pnl?group=day", headers=admin_h)
    assert r.status_code == 200
    j = r.json()
    assert "rows" in j and "total" in j


def test_reports_stock(admin_h):
    r = requests.get(f"{API}/reports/stock", headers=admin_h).json()
    assert "rows" in r and "reserved" in r


def test_reports_receivables(admin_h):
    r = requests.get(f"{API}/reports/receivables", headers=admin_h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_dashboard(admin_h, kasir_h):
    a = requests.get(f"{API}/dashboard", headers=admin_h).json()
    k = requests.get(f"{API}/dashboard", headers=kasir_h).json()
    assert "today" in a and "profit" in a["today"]
    assert "profit" not in k["today"]


# ---------- Expense ----------
def test_expense_crud(admin_h):
    e = requests.post(f"{API}/expenses", headers=admin_h,
                      json={"name": "TEST_Exp", "amount": 12345, "category": "Operasional"}).json()
    assert e["amount"] == 12345
    up = requests.put(f"{API}/expenses/{e['id']}", headers=admin_h, json={"amount": 20000}).json()
    assert up["amount"] == 20000
    d = requests.delete(f"{API}/expenses/{e['id']}", headers=admin_h)
    assert d.status_code == 200


# ---------- Backup ----------
def test_backup_json(admin_h):
    r = requests.get(f"{API}/backup/export", headers=admin_h)
    assert r.status_code == 200
    data = json.loads(r.content.decode())
    assert "data" in data and "products" in data["data"]


def test_backup_csv(admin_h):
    r = requests.get(f"{API}/backup/csv/products", headers=admin_h)
    assert r.status_code == 200
    assert b"name" in r.content


def test_backup_csv_users_denied(admin_h):
    r = requests.get(f"{API}/backup/csv/users", headers=admin_h)
    assert r.status_code == 400


# ---------- User CRUD ----------
def test_create_kasir_user(admin_h):
    u = requests.post(f"{API}/users", headers=admin_h,
                      json={"username": f"TEST_kasir2_{int(time.time())}", "password": "test123", "role": "kasir",
                            "name": "Kasir Test"}).json()
    assert "id" in u and "password_hash" not in u
    requests.delete(f"{API}/users/{u['id']}", headers=admin_h)
