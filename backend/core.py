import os
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
WIB = timezone(timedelta(hours=7))
JWT_ALG = "HS256"
HPP_KEYS = {"hpp", "hpp_unit", "hpp_total", "profit", "margin", "stock_value"}
PO_MONEY_KEYS = HPP_KEYS | {"subtotal", "total", "total_manual", "paid_amount", "paid_status", "debt"}
NO_ID = {"_id": 0}


def uid():
    return str(uuid.uuid4())


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today(offset_days=0):
    return (datetime.now(WIB) + timedelta(days=offset_days)).strftime("%Y-%m-%d")


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_token(user: dict) -> str:
    payload = {"sub": user["id"], "role": user["role"], "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def get_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Belum login")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi berakhir, silakan login ulang")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"], "active": {"$ne": False}}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User tidak ditemukan")
    return user


async def require_admin(user: dict = Depends(get_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Akses khusus Admin/Pemilik")
    return user


def is_admin(user):
    return user.get("role") == "admin"


def strip_keys(obj, keys=HPP_KEYS):
    if isinstance(obj, list):
        return [strip_keys(o, keys) for o in obj]
    if isinstance(obj, dict):
        return {k: strip_keys(v, keys) for k, v in obj.items() if k not in keys}
    return obj


async def next_seq(key: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return doc["seq"]


async def po_number(prefix: str) -> str:
    yy = datetime.now(WIB).strftime("%y")
    seq = await next_seq(f"PO-{prefix}-{yy}")
    return f"{prefix}{yy}{seq:04d}"


async def doc_number(kind: str) -> str:
    ym = datetime.now(WIB).strftime("%y%m")
    seq = await next_seq(f"{kind}-{ym}")
    return f"{kind}-{ym}-{seq:04d}"
