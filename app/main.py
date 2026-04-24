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
from pydantic import BaseModel
from seed_admin import create_superuser
from seed_db import seed_test_emails
from app.seed_firetms import seed_all
from fastapi.middleware.cors import CORSMiddleware



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

# --- Task 2.2: integracja giełdowa ---
app.include_router(exchange_router, prefix="/api", tags=["exchange"])

templates = Jinja2Templates(directory="app/templates")

# Serwowanie wygenerowanych dokumentów CMR
_static_docs = Path("static/docs")
_static_docs.mkdir(parents=True, exist_ok=True)
app.mount("/web", StaticFiles(directory="app/web"), name="web")
app.mount("/static", StaticFiles(directory="static"), name="static")
class CategoryUpdate(BaseModel):
    category: str

class RescanRequest(BaseModel):
    custom_categories: list[str] = []


# ──────────────────────────────────────────────────────────
# WebSocket Connection Manager
# ──────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_text(self, websocket: WebSocket, message: str):
        await websocket.send_text(message)


ws_manager = ConnectionManager()

@app.get("/")
def render_landing(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@app.get("/dashboard")
def render_main_dashboard(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("dashboard_main.html", {"request": request})

@app.get("/seed-danych")
def zasiej_dane():
    seed_test_emails()
    return {"status": "Dane załadowane na produkcję!"}

@app.get("/mail")
def render_mail(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("mail.html", {"request": request})

@app.get("/compare")
def render_compare(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("compare.html", {"request": request})

# ──────────────────────────────────────────────────────────
# Auth Routes
# ──────────────────────────────────────────────────────────

@app.get("/login")
def render_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user or not verify_password(password, user.hashed_password):
            return templates.TemplateResponse(
                "login.html", 
                {"request": request, "error": "Nieprawidłowy login lub hasło."}
            )
        
        access_token = create_access_token(data={"sub": user.username})
        
        response = RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
        response.set_cookie(
            key="access_token", 
            value=f"Bearer {access_token}", 
            httponly=True,
            samesite="lax"
        )
        return response

@app.get("/logout")
def logout():
    response = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("access_token")
    return response


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
    usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    
    for email in test_emails:
        time.sleep(0.5)
        kategoria, usage = categorize_email_with_gemma(email["subject"], email["body"])
        
        if usage:
            usage_total["prompt_tokens"] += usage.get("prompt_tokens", 0)
            usage_total["completion_tokens"] += usage.get("completion_tokens", 0)
            usage_total["total_tokens"] += usage.get("total_tokens", 0)
            
        results.append({
            "test_nr": email["id"],
            "temat": email["subject"],
            "werdykt_ai": kategoria,
            "status": "✅ ZDANY" if kategoria != "INNE" or email["id"] == 5 else "⚠️ SPRAWDŹ"
        })
        
    return {"raport_z_poligonu": results, "usage": usage_total}

@app.get("/api/stats")
def get_email_stats(user: User = Depends(get_current_user)):
    """Zwraca liczbę maili pogrupowanych po ai_category."""
    with Session(engine) as session:
        rows = session.exec(
            select(EmailLog.ai_category, func.count(EmailLog.id).label("count"))
            .where(EmailLog.is_deleted == False)
            .group_by(EmailLog.ai_category)
        ).all()
        return {row[0] or "INNE": row[1] for row in rows}

@app.get("/api/emails")
def get_emails(limit: int = 100, kategoria: Optional[str] = None, szukaj: Optional[str] = None):
    with Session(engine) as session:
        query = select(EmailLog).where(EmailLog.is_deleted == False)
        
        if kategoria and kategoria != "WSZYSTKIE":
            query = query.where(EmailLog.ai_category == kategoria)
        
        if szukaj:
            query = query.where(EmailLog.subject.contains(szukaj) | EmailLog.sender.contains(szukaj))
            
        query = query.order_by(EmailLog.id.desc()).limit(limit)
        
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
    return {"status": "success", "message": "Mail zarchiwizowany (Funkcja w budowie)"}
    
@app.delete("/api/emails/{email_id}")
def delete_single_email(email_id: int):
    with Session(engine) as session:
        email = session.get(EmailLog, email_id)
        if not email:
            return {"error": "Nie znaleziono maila"}
        session.delete(email)
        session.commit()
        return {"status": "success"}

class BulkDeleteRequest(BaseModel):
    email_ids: list[int]

@app.post("/api/emails/bulk-delete")
def bulk_delete_emails(payload: BulkDeleteRequest):
    with Session(engine) as session:
        deleted_count = 0
        for eid in payload.email_ids:
            email = session.get(EmailLog, eid)
            if email:
                session.delete(email)
                deleted_count += 1
        session.commit()
        return {"status": "success", "deleted": deleted_count}

@app.post("/api/emails/rescan")
def rescan_emails(payload: RescanRequest):
    with Session(engine) as session:
        inne_emails = session.exec(select(EmailLog).where(
            (EmailLog.ai_category == "INNE") | (EmailLog.ai_category == None), 
            EmailLog.is_deleted == False
        )).all()
        updated_count = 0
        
        from bs4 import BeautifulSoup
        for email in inne_emails:
            clean_text = BeautifulSoup(email.body, "html.parser").get_text(separator=' ', strip=True) if email.body else ""
            new_cat = categorize_email_with_gemma(email.subject, clean_text, payload.custom_categories)
            
            if new_cat != email.ai_category:
                email.ai_category = new_cat
                session.add(email)
                updated_count += 1
                
        session.commit()
        return {"status": "success", "scanned": len(inne_emails), "updated": updated_count}


# ──────────────────────────────────────────────────────────
# Chat Routes
# ──────────────────────────────────────────────────────────

@app.get("/chat")
def render_chat(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse("chat.html", {"request": request})

@app.get("/magiczny-guzik")
def odpal_admina():
    url = os.getenv("DATABASE_URL")
    print(f"DEBUG: Moja zmienna DATABASE_URL to: {url}")
    
    if not url:
        return {"error": "Mordo, serwer w ogóle nie widzi zmiennej DATABASE_URL w systemie!"}
    
    try:
        from seed_admin import create_superuser
        create_superuser()
        return {"status": "Sukces! Admin dodany."}
    except Exception as e:
        return {"error": f"Błąd bazy: {str(e)}", "url_widziany_przez_app": url}

@app.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    session_id = websocket.client.host if websocket.client else "anonymous"
    try:
        while True:
            data = await websocket.receive_text()

            from app.services.chat_bot import process_driver_message
            loop = asyncio.get_event_loop()
            with Session(engine) as db_session:
                response = await loop.run_in_executor(
                    None,
                    lambda: process_driver_message(data, db_session, session_id),
                )

            await ws_manager.send_text(websocket, response)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        ws_manager.disconnect(websocket)
