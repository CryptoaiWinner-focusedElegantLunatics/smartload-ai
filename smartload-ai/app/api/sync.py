from typing import Optional
import time
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.core.database import engine, get_session
from app.models.load import Load
from app.scraper.runner import run_all_scrapers
from app.services.tasks import process_emails_task
from app.services.ai_triage import categorize_email_with_gemma

router = APIRouter(tags=["sync"])


@router.get("/loads", response_model=list[Load])
def get_loads(session: Session = Depends(get_session), limit: int = 100):
    return session.exec(select(Load).limit(limit)).all()


@router.post("/admin/sync-emails")
def trigger_background_sync(limit: Optional[int] = 50):
    task = process_emails_task.delay(limit)
    return {
        "status": "processing",
        "task_id": task.id,
        "message": f"Email sync triggered for {limit} messages.",
    }


@router.post("/admin/sync-loads")
async def trigger_scraper():
    await run_all_scrapers()
    return {"status": "ok", "message": "Scraper triggered successfully."}


@router.get("/admin/test-ai")
def test_ai_engine():
    test_emails = [
        {
            "id": 1,
            "subject": "Ładunek 24t plandeka DE-PL",
            "body": "Szukam auta na jutro z Berlina do Warszawy. Stawka 1200 EUR. Ktoś wolny?",
        },
        {
            "id": 2,
            "subject": "Zlecenie transportowe nr 456/2026",
            "body": "Dzień dobry, w załączniku przesyłam oficjalne zlecenie do naszej wczorajszej rozmowy. Proszę o odesłanie podpisanego skanu.",
        },
        {
            "id": 3,
            "subject": "Faktura FV 12/04/2026 trans.eu",
            "body": "Dzień dobry, przesyłamy elektroniczną fakturę VAT za abonament za miesiąc kwiecień.",
        },
        {
            "id": 4,
            "subject": "Skan CMR - trasa Lyon",
            "body": "Szefie, zrzuciłem towar, wszystko OK. Podsyłam podbitą CMR-kę, czysta bez uwag.",
        },
        {
            "id": 5,
            "subject": "Wielka wyprzedaż opon ciężarowych!",
            "body": "Tylko w tym tygodniu! Kup 4 opony na oś napędową marki Michelin, a dostaniesz rabat 20% i darmową dostawę!",
        },
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
            "subject": email["subject"],
            "ai_verdict": kategoria,
            "status": "✅ PASS" if kategoria != "INNE" or email["id"] == 5 else "⚠️ CHECK",
        })

    return {"report": results, "usage": usage_total}
