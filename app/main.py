from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi import Request
from fastapi.templating import Jinja2Templates
import time
from fastapi import FastAPI, Depends, APIRouter
from sqlmodel import SQLModel, Session, select
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import engine, get_session
from app.models.load import Load
from app.models.email_log import EmailLog
from app.services.ai_triage import categorize_email_with_gemma
from app.services.tasks import process_emails_task
from app.scraper.runner import run_all_scrapers  # nie manager!
from app.api import loads  # ← BRAKUJĄCY IMPORT
from app.api.documents import router as documents_router
from pydantic import BaseModel


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


app = FastAPI(title="SmartLoad AI API")
app.include_router(loads.router, prefix="/api", tags=["loads"])  # ← poprawione
app.include_router(documents_router)
templates = Jinja2Templates(directory="app/templates")
class CategoryUpdate(BaseModel):
    category: str

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

@app.get("/test-ai-triage")
def test_ai_engine():
    test_emails = [
        {
            "id": 1,
            "subject": "Ładunek 24t plandeka DE-PL", 
            "body": "Szukam auta na jutro z Berlina do Warszawy. Stawka 1200 EUR. Ktoś wolny?"
        },
        {
            "id": 2,
            "subject": "Zlecenie transportowe nr 456/2026", 
            "body": "Dzień dobry, w załączniku przesyłam oficjalne zlecenie do naszej wczorajszej rozmowy. Proszę o odesłanie podpisanego skanu."
        },
        {
            "id": 3,
            "subject": "Faktura FV 12/04/2026 trans.eu", 
            "body": "Dzień dobry, przesyłamy elektroniczną fakturę VAT za abonament za miesiąc kwiecień."
        },
        {
            "id": 4,
            "subject": "Skan CMR - trasa Lyon", 
            "body": "Szefie, zrzuciłem towar, wszystko OK. Podsyłam podbitą CMR-kę, czysta bez uwag."
        },
        {
            "id": 5,
            "subject": "Wielka wyprzedaż opon ciężarowych!", 
            "body": "Tylko w tym tygodniu! Kup 4 opony na oś napędową marki Michelin, a dostaniesz rabat 20% i darmową dostawę!"
        }
    ]

    results = []
    
    for email in test_emails:
        time.sleep(0.5)
        kategoria = categorize_email_with_gemma(email["subject"], email["body"])
        results.append({
            "test_nr": email["id"],
            "temat": email["subject"],
            "werdykt_ai": kategoria,
            "status": "✅ ZDANY" if kategoria != "INNE" or email["id"] == 5 else "⚠️ SPRAWDŹ"
        })
        
    return {"raport_z_poligonu": results}

@app.get("/dashboard")
def render_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/api/emails")
def get_emails(kategoria: Optional[str] = None, szukaj: Optional[str] = None):
    with Session(engine) as session:
        query = select(EmailLog)
        
        # Opcja dodawania własnych filtrów!
        if kategoria and kategoria != "WSZYSTKIE":
            query = query.where(EmailLog.ai_category == kategoria)
        
        if szukaj:
            # Wyszukuje po temacie lub nadawcy
            query = query.where(EmailLog.subject.contains(szukaj) | EmailLog.sender.contains(szukaj))
            
        # Sortujemy od najnowszych
        query = query.order_by(EmailLog.id.desc()).limit(100)
        
        results = session.exec(query).all()
        return results
        
@app.put("/api/emails/{email_id}/category")
def update_email_category(email_id: int, payload: CategoryUpdate):
    with Session(engine) as session:
        email = session.get(EmailLog, email_id)
        if not email:
            return {"error": "Nie znaleziono maila"}
            
        email.ai_category = payload.category.upper()
        session.add(email)
        session.commit()
        return {"status": "success", "new_category": email.ai_category}

@app.put("/api/emails/{email_id}/archive")
def archive_email(email_id: int):
    # TODO na przyszłość: Dodaj kolumnę 'is_archived: bool = False' do app.models.email_log.EmailLog
    # Na razie robimy "zaślepkę", która udaje, że działa
    return {"status": "success", "message": "Mail zarchiwizowany (Funkcja w budowie)"}
