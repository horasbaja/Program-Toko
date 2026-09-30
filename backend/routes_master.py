from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import (db, uid, now_iso, today, hash_password, verify_password, create_token, get_user,
                  require_admin, is_admin, strip_keys, doc_number, NO_ID)
from services import adjust_stock, f

router = APIRouter(prefix="/api")


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def login(body: LoginIn, request: Request):
    uname = body.username.strip().lower()
    ident = f"{request.client.host if request.client else 'x'}:{uname}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("until", "") > now_iso():
        raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi 15 menit lagi")
    user = await db.users.find_one({"username": uname, "active": {"$ne": False}})
    if not user or not verify_password(body.password, user["password_hash"]):
        from datetime import datetime, timezone, timedelta
        until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"until": until}}, upsert=True)
        raise HTTPException(401, "Username atau password salah")
    await db.login_attempts.delete_many({"identifier": ident})
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"token": create_token(user), "user": safe}


@router.get("/auth/me")
async def me(user=Depends(get_user)):
    return user


# ---------- Users (admin) ----------
@router.get("/users")
async def list_users(_=Depends(require_admin)):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)


@router.post("/users")
async def create_user(body: dict, _=Depends(require_admin)):
    uname = (body.get("username") or "").strip().lower()
    if not uname or not body.get("password"):
        raise HTTPException(400, "Username & password wajib")
    if await db.users.find_one({"username": uname}):
        raise HTTPException(400, "Username sudah dipakai")
    doc = {"id": uid(), "username": uname, "name": body.get("name") or uname, "role": body.get("role", "kasir"),
           "active": True, "password_hash": hash_password(body["password"]), "created_at": now_iso()}
    await db.users.insert_one(dict(doc))
    doc.pop("password_hash")
    return doc


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: dict, _=Depends(require_admin)):
    upd = {k: body[k] for k in ("name", "role", "active") if k in body}
    if body.get("password"):
        upd["password_hash"] = hash_password(body["password"])
    await db.users.update_one({"id": user_id}, {"$set": upd})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ---------- Settings & warehouses ----------
@router.get("/settings")
async def get_settings(_=Depends(get_user)):
    return await db.settings.find_one({"id": "store"}, NO_ID)


@router.put("/settings")
async def put_settings(body: dict, _=Depends(require_admin)):
    body.pop("_id", None)
    body["id"] = "store"
    await db.settings.replace_one({"id": "store"}, body, upsert=True)
    return body


@router.get("/warehouses")
async def list_wh(_=Depends(get_user)):
    return await db.warehouses.find({}, NO_ID).sort("code", 1).to_list(50)


@router.put("/warehouses/{code}")
async def put_wh(code: str, body: dict, _=Depends(require_admin)):
    await db.warehouses.update_one({"code": code}, {"$set": {k: body[k] for k in ("name", "address") if k in body}})
    return await db.warehouses.find_one({"code": code}, NO_ID)


# ---------- Generic CRUD: categories, suppliers, customers ----------
CRUD = {"categories": (require_admin, require_admin), "suppliers": (require_admin, require_admin),
        "customers": (get_user, get_user)}


def make_crud(name, read_dep, write_dep):
    @router.get(f"/{name}", name=f"list_{name}")
    async def _list(user=Depends(get_user)):
        docs = await db[name].find({}, NO_ID).sort("name", 1).to_list(5000)
        if name == "suppliers" and not is_admin(user):
            docs = [{k: d.get(k) for k in ("id", "name", "prefix")} for d in docs]
        return docs

    @router.post(f"/{name}", name=f"create_{name}")
    async def _create(body: dict, _=Depends(write_dep)):
        body.pop("_id", None)
        body["id"] = uid()
        body["created_at"] = now_iso()
        if name == "suppliers":
            body["prefix"] = (body.get("prefix") or "").upper().strip()
            if not body["prefix"]:
                raise HTTPException(400, "Kode Prefix PO wajib diisi")
        await db[name].insert_one(dict(body))
        return body

    @router.put(f"/{name}/{{item_id}}", name=f"update_{name}")
    async def _update(item_id: str, body: dict, _=Depends(write_dep)):
        body.pop("_id", None)
        body.pop("id", None)
        if name == "suppliers" and "prefix" in body:
            body["prefix"] = body["prefix"].upper().strip()
        await db[name].update_one({"id": item_id}, {"$set": body})
        if name == "categories" and "name" in body:
            await db.products.update_many({"category_id": item_id}, {"$set": {"category_name": body["name"]}})
        return await db[name].find_one({"id": item_id}, NO_ID)

    @router.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
    async def _delete(item_id: str, _=Depends(require_admin)):
        await db[name].delete_one({"id": item_id})
        return {"ok": True}


for _n, (_r, _w) in CRUD.items():
    make_crud(_n, _r, _w)


# ---------- Products ----------
PRODUCT_FIELDS = ("name", "category_id", "supplier_id", "brand", "thickness", "color", "unit", "is_length",
                  "length", "price", "bend_fee", "hpp", "min_stock", "alt_units", "stock", "sku")


async def normalize_product(body: dict) -> dict:
    doc = {k: body[k] for k in PRODUCT_FIELDS if k in body}
    cat = await db.categories.find_one({"id": doc.get("category_id")}, NO_ID)
    if cat:
        doc["category_name"] = cat["name"]
        doc.setdefault("is_length", cat.get("is_length", False))
    for k in ("price", "bend_fee", "hpp", "min_stock", "length"):
        if k in doc:
            doc[k] = f(doc[k])
    if "stock" in doc:
        doc["stock"] = {w: f(v) for w, v in (doc["stock"] or {}).items()}
    return doc


@router.get("/products")
async def list_products(user=Depends(get_user)):
    docs = await db.products.find({}, NO_ID).sort("name", 1).to_list(5000)
    return docs if is_admin(user) else strip_keys(docs)


@router.post("/products")
async def create_product(body: dict, _=Depends(require_admin)):
    doc = await normalize_product(body)
    doc.setdefault("stock", {"G1": 0, "G2": 0})
    doc.update({"id": uid(), "created_at": now_iso()})
    await db.products.insert_one(dict(doc))
    return doc


@router.put("/products/{pid}")
async def update_product(pid: str, body: dict, _=Depends(require_admin)):
    await db.products.update_one({"id": pid}, {"$set": await normalize_product(body)})
    return await db.products.find_one({"id": pid}, NO_ID)


@router.delete("/products/{pid}")
async def delete_product(pid: str, _=Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ---------- Stock transfer ----------
class TransferIn(BaseModel):
    product_id: str
    from_wh: str
    to_wh: str
    qty: float
    note: Optional[str] = ""


@router.post("/stock/transfer")
async def transfer(body: TransferIn, user=Depends(get_user)):
    if body.from_wh == body.to_wh or body.qty <= 0:
        raise HTTPException(400, "Gudang asal/tujuan & qty tidak valid")
    p = await db.products.find_one({"id": body.product_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if f(p.get("stock", {}).get(body.from_wh)) < body.qty:
        raise HTTPException(400, "Stok gudang asal tidak mencukupi")
    await adjust_stock(body.product_id, body.from_wh, -body.qty)
    await adjust_stock(body.product_id, body.to_wh, body.qty)
    doc = {"id": uid(), "no": await doc_number("TRF"), "date": today(), "product_id": p["id"], "product_name": p["name"],
           "unit": p.get("unit"), "from_wh": body.from_wh, "to_wh": body.to_wh, "qty": body.qty, "note": body.note,
           "by": user["name"], "created_at": now_iso()}
    await db.stock_transfers.insert_one(dict(doc))
    return doc


@router.get("/stock/transfers")
async def list_transfers(_=Depends(get_user)):
    return await db.stock_transfers.find({}, NO_ID).sort("created_at", -1).to_list(300)


@router.get("/bootstrap")
async def bootstrap(user=Depends(get_user)):
    return {
        "settings": await db.settings.find_one({"id": "store"}, NO_ID),
        "warehouses": await db.warehouses.find({}, NO_ID).sort("code", 1).to_list(50),
        "categories": await db.categories.find({}, NO_ID).sort("name", 1).to_list(500),
        "suppliers": await _list_suppliers(user),
        "products": await list_products(user),
        "customers": await db.customers.find({}, NO_ID).sort("name", 1).to_list(5000),
        "synced_at": now_iso(),
    }


async def _list_suppliers(user):
    docs = await db.suppliers.find({}, NO_ID).sort("name", 1).to_list(500)
    return docs if is_admin(user) else [{k: d.get(k) for k in ("id", "name", "prefix")} for d in docs]
