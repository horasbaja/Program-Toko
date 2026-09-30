from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import os  # noqa: E402
import logging  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from core import db, client  # noqa: E402
from routes_master import router as master_router  # noqa: E402
from routes_sales import router as sales_router  # noqa: E402
from routes_purchases import router as purchases_router  # noqa: E402
from routes_reports import router as reports_router  # noqa: E402
from seed import seed_all  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
app = FastAPI(title="HORAS BAJA POS API")


@app.get("/api/")
async def root():
    return {"message": "HORAS BAJA POS API", "status": "ok"}


for r in (master_router, sales_router, purchases_router, reports_router):
    app.include_router(r)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.login_attempts.create_index("identifier")
    for c in ("products", "sales", "purchases", "customers"):
        await db[c].create_index("id", unique=True)
    await db.sales.create_index("date")
    await db.sales.create_index("offline_id")
    await seed_all()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
