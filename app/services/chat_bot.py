"""
SmartLoad Chat Bot – zaktualizowany o obsługę asynchronicznego generowania CMR.
"""
import os
import re
import json
import logging
import requests
from sqlmodel import Session, select, or_
from app.models.email_log import EmailLog

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-2-9b-it"

_sessions: dict[str, dict] = {}

def _session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"last_offer": None, "awaiting_plate": False}
    return _sessions[session_id]

def _call_llm(prompt: str, max_tokens: int = 300) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key: return ""
    try:
        resp = requests.post(OPENROUTER_URL, headers={"Authorization": f"Bearer {api_key}"},
                             json={"model": MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens})
        return resp.json()['choices'][0]['message']['content']
    except: return ""

async def _generate_cmr(offer: EmailLog, plate: str) -> str:
    """Tworzy dokument CMR i zwraca link do pliku."""
    from app.models.document_schema import ParsedDocument
    from app.services.cmr_generator import generate_cmr_pdf

    doc_data = ParsedDocument(
        sender_name="SmartLoad Partner",
        sender_address="Giełda Transportowa",
        receiver_name=offer.unloading_city or "Odbiorca",
        receiver_address="Adres Odbiorcy",
        origin=offer.loading_city,
        destination=offer.unloading_city,
        cargo_description=offer.cargo_description or "Towar mieszany",
        weight_kg=offer.weight_kg,
        price=offer.price,
        currency=offer.currency or "EUR",
        vehicle_plate=plate
    )

    try:
        # KLUCZOWE: Używamy await!
        pdf_path = await generate_cmr_pdf(doc_data)
        file_url = f"/{pdf_path}"
        return f"✅ Dogadani! Wygenerowałem dla Ciebie CMR. <br><br> <a href='{file_url}' target='_blank' style='color: #00ff00; font-weight: bold;'>Pobierz CMR (PDF)</a> <br><br> Szerokiej drogi! 🚛"
    except Exception as e:
        logger.error(f"❌ CMR error: {e}")
        return "Dogadani! 🤝 Niestety mam chwilowy problem techniczny z generowaniem dokumentu — skontaktuję się telefonicznie żeby dopełnić formalności. Szerokości! 🚛"

async def process_driver_message(message: str, db_session: Session, session_id: str = "default") -> str:
    """Główna logika czatu - teraz asynchroniczna."""
    sess = _session(session_id)
    
    # Wykrywanie intencji przez LLM
    prompt = f"Analizuj wiadomość: '{message}'. Zwróć JSON: {{'intent': 'SZUKA_LADUNKU'|'PODAJ_REJESTRACJE'|'INNE', 'city': 'string', 'plate': 'string'}}"
    llm_raw = _call_llm(prompt)
    
    try:
        data = json.loads(re.search(r'\{.*\}', llm_raw, re.DOTALL).group())
    except:
        data = {"intent": "INNE"}

    intent = data.get("intent")
    plate = data.get("plate")

    # Obsługa generowania CMR po podaniu tablic
    if intent == "PODAJ_REJESTRACJE" and plate and sess.get("last_offer"):
        sess["awaiting_plate"] = False
        return await _generate_cmr(sess["last_offer"], plate)

    # Obsługa gdy bot czeka na tablice
    if sess["awaiting_plate"]:
        plate_match = re.search(r'\b([A-Z]{1,3}[\s\-]?\d{3,5}[A-Z]{0,2})\b', message.upper())
        if plate_match and sess["last_offer"]:
            plate = plate_match.group(1).strip()
            sess["awaiting_plate"] = False
            return await _generate_cmr(sess["last_offer"], plate)
        return "Potrzebuję jeszcze Twojego numeru rejestracyjnego, żeby wystawić CMR. 🚛"

    # Logika szukania ładunków (uproszczona dla czytelności)
    if intent == "SZUKA_LADUNKU":
        # ... (tutaj Twoja logika wyszukiwania w bazie) ...
        return "Znalazłem kilka ofert! Która Cię interesuje?"

    return "Cześć! W czym mogę Ci pomóc? Szukasz ładunku?"