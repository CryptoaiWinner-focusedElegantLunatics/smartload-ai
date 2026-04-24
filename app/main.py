from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler


from app.core.database import engine
from app.scraper.runner import run_all_scrapers
from app.services.tasks import process_emails_task
from app.seeds.seed_firetms import seed_all
from app.api import loads
from app.api.auth import router as auth_router
from app.api.views import router as views_router
from app.api.emails import router as emails_router
from app.api.sync import router as sync_router
from app.api.admin import router as admin_router
from app.api.websocket import router as websocket_router
from app.api.documents import router as documents_router
from app.api.contractors import router as contractors_router
from app.api.offers import router as offers_router
from app.api.orders import router as orders_router
from app.api.departments import router as departments_router
from app.api.exchange import router as exchange_router

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    with Session(engine) as session:
        session.exec(text("CREATE EXTENSION IF NOT EXISTS vector"))
        session.commit()

    SQLModel.metadata.create_all(engine)
    seed_all()

    with Session(engine) as session:
        try:
            session.exec(text(
                "ALTER TABLE emaillog ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE"
            ))
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"⚠️ MIGRACJA ZIGNOROWANA (być może kolumna już istnieje): {e}")

    await run_all_scrapers()

    scheduler.add_job(run_all_scrapers, "interval", minutes=15)

    def trigger_imap_sync():
        process_emails_task.delay(40)

    scheduler.add_job(trigger_imap_sync, "interval", minutes=1)
    scheduler.start()

    yield

    scheduler.shutdown()


app = FastAPI(title="SmartLoad AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("static/docs").mkdir(parents=True, exist_ok=True)
app.mount("/web", StaticFiles(directory="app/web"), name="web")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Views & auth
app.include_router(auth_router)
app.include_router(views_router)
app.include_router(websocket_router)

# App features
app.include_router(emails_router)
app.include_router(sync_router)
app.include_router(admin_router)
app.include_router(documents_router)
app.include_router(loads.router, prefix="/api", tags=["loads"])

# fireTMS mock API
app.include_router(contractors_router, prefix="/api", tags=["contractors"])
app.include_router(offers_router, prefix="/api", tags=["offers"])
app.include_router(orders_router, prefix="/api", tags=["orders"])
app.include_router(departments_router, prefix="/api", tags=["departments"])
app.include_router(exchange_router, prefix="/api", tags=["exchange"])
