from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from sqlmodel import SQLModel, Session, select
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import engine, get_session
from app.models.load import Load
from app.services.tasks import process_emails_task
from app.scraper.runner import run_all_scrapers  # nie manager!
from app.api import loads  # ← BRAKUJĄCY IMPORT


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    with Session(engine) as session:
        session.exec(text("CREATE EXTENSION IF NOT EXISTS vector"))
        session.commit()
    SQLModel.metadata.create_all(engine)

    await run_all_scrapers()

    scheduler.add_job(run_all_scrapers, "interval", minutes=15)
    scheduler.start()

    yield

    scheduler.shutdown()


app = FastAPI(title="SmartLoad AI API", lifespan=lifespan)

app.include_router(loads.router, prefix="/api", tags=["loads"])  # ← poprawione


@app.get("/")
def read_root():
    return {"status": "SmartLoad AI is running", "mordeczko": "Logistyka przejęta!"}


@app.get("/db-check")
def check_db(session: Session = Depends(get_session)):
    loads_list = session.exec(select(Load)).all()
    return {"status": "success", "loads_count": len(loads_list)}


@app.get("/loads", response_model=list[Load])
def get_loads(session: Session = Depends(get_session), limit: int = 100):
    return session.exec(select(Load).limit(limit)).all()


@app.post("/sync-emails")
def trigger_background_sync(limit: Optional[int] = 50):
    task = process_emails_task.delay(limit)
    return {
        "status": "processing",
        "task_id": task.id,
        "message": f"Zlecono pobranie {limit} maili w tle."
    }


@app.post("/sync-loads")
async def trigger_scraper():
    await run_all_scrapers()
    return {"status": "ok", "message": "Scraper uruchomiony"}