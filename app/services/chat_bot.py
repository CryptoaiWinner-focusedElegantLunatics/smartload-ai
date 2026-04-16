"""
SmartLoad Chat Bot – silnik AI dla komunikatora kierowców.

Pipeline:
  Krok A: Wykryj intencję (JSON: intent + city/plate_number)
  Krok B: Wyszukaj oferty w DB (dla SZUKA_LADUNKU)
  Krok C: Wygeneruj odpowiedź LLM lub dokument CMR
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
MODEL = "google/gemma-4-26b-a4b-it"
PROVIDER = {"order": ["Together", "Fireworks", "DeepInfra"]}

# ── Sesyjny cache per session_id ──────────────────────────────────────────────
# last_offer       → EmailLog — ostatnio zaproponowana oferta
# awaiting_plate   → bool    — czy czekamy na numer rejestracyjny
_sessions: dict[str, dict] = {}


def _session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"last_offer": None, "awaiting_plate": False}
    return _sessions[session_id]


# ── LLM helper ────────────────────────────────────────────────────────────────

def _call_llm(prompt: str, max_tokens: int = 300) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return ""
    try:
        resp = requests.post(
            url=OPENROUTER_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": MODEL,
                "provider": PROVIDER,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            },
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("choices"):
                return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"❌ LLM error: {e}")
    return ""


# ── Krok A: Wykrycie intencji ─────────────────────────────────────────────────

def _extract_intent(message: str, awaiting_plate: bool) -> dict:
    """
    Zwraca dict z polami:
      intent: SZUKA_LADUNKU | AKCEPTUJE_LADUNEK | PODAJ_REJESTRACJE | INNE
      city: str | null
      plate_number: str | null
    """
    plate_hint = (
        'Jeśli wiadomość zawiera numer rejestracyjny pojazdu (np. "WA12345", "KR 1234A", "DW 123AB"), '
        'ustaw intent="PODAJ_REJESTRACJE" i plate_number=wartość rejestracji.'
        if awaiting_plate else ""
    )

    prompt = f"""Jesteś asystentem AI w firmie spedycyjnej. Przeczytaj wiadomość kierowcy.
Zwróć WYŁĄCZNIE czysty JSON (bez markdown, bez komentarzy) z polami:
- "intent": jedno z: "SZUKA_LADUNKU", "AKCEPTUJE_LADUNEK", "PODAJ_REJESTRACJE", "INNE"
- "city": nazwa miasta załadunku lub null
- "plate_number": numer rejestracyjny pojazdu lub null

Definicje intencji:
- SZUKA_LADUNKU: kierowca podaje lokalizację i szuka ładunku
- AKCEPTUJE_LADUNEK: kierowca zgadza się na zaproponowaną trasę (ok, biorę, tak, pasuje, dogadane, akceptuję)
- PODAJ_REJESTRACJE: wiadomość zawiera numer rejestracyjny pojazdu
- INNE: pozdrowienia, pytania ogólne, inne

{plate_hint}

Przykłady:
"Jestem w Berlinie, mam wolne 24t" → {{"intent":"SZUKA_LADUNKU","city":"Berlin","plate_number":null}}
"OK biorę tę trasę!" → {{"intent":"AKCEPTUJE_LADUNEK","city":null,"plate_number":null}}
"Moja rejestracja to WA 12345" → {{"intent":"PODAJ_REJESTRACJE","city":null,"plate_number":"WA 12345"}}
"DW 9876C" → {{"intent":"PODAJ_REJESTRACJE","city":null,"plate_number":"DW 9876C"}}

Wiadomość kierowcy: "{message}"
JSON:"""

    raw = _call_llm(prompt, max_tokens=80)
    raw = re.sub(r'```json\n?', '', raw)
    raw = re.sub(r'```\n?', '', raw).strip()

    try:
        result = json.loads(raw)
        intent = result.get("intent", "INNE")
        if intent not in ("SZUKA_LADUNKU", "AKCEPTUJE_LADUNEK", "PODAJ_REJESTRACJE", "INNE"):
            intent = "INNE"
        return {
            "intent": intent,
            "city": result.get("city"),
            "plate_number": result.get("plate_number"),
        }
    except Exception:
        logger.warning(f"⚠️ Nie udało się sparsować intencji: {raw!r}")
        return {"intent": "INNE", "city": None, "plate_number": None}


# ── Krok B: Wyszukiwanie ofert ────────────────────────────────────────────────

def _find_offers(city: str, db_session: Session) -> list[EmailLog]:
    query = select(EmailLog).where(
        EmailLog.is_deleted == False,
        or_(EmailLog.ai_category == "OFERTA", EmailLog.ai_category == "ZAMOWIENIE"),
        or_(
            EmailLog.loading_city.icontains(city),
            EmailLog.subject.icontains(city),
        )
    ).limit(3)
    return db_session.exec(query).all()


# ── Krok C: Odpowiedź ofertowa ────────────────────────────────────────────────

def _build_offer_response(driver_message: str, city: str, offers: list[EmailLog]) -> str:
    if offers:
        offers_text = ""
        for i, o in enumerate(offers, 1):
            route = f"{o.loading_city or '?'} → {o.unloading_city or '?'}"
            price = f"{o.price} {o.currency}" if o.price else "do ustalenia"
            weight = f"{o.weight_kg} kg" if o.weight_kg else "?"
            offers_text += f"\nOferta {i}: {route} | {weight} | {price}"

        prompt = f"""Jesteś uprzejmym spedytorem w polskiej firmie. Odpowiedz krótko (2-4 zd.), po polsku.
Zaproponuj oferty. Na końcu zapytaj "Pasuje Ci?" lub "Bierzesz?".

Wiadomość: "{driver_message}"
Miasto: {city}
Oferty:{offers_text}

Odpowiedź spedytora:"""
    else:
        prompt = f"""Jesteś uprzejmym spedytorem. Odpowiedz krótko (2-3 zd.), po polsku.
Brak ofert z {city}. Przeproś i obiecaj odezwać się gdy coś się pojawi.

Wiadomość: "{driver_message}"
Odpowiedź spedytora:"""

    return _call_llm(prompt, max_tokens=250)


# ── Generowanie CMR ───────────────────────────────────────────────────────────

def _generate_cmr(offer: EmailLog, plate: str) -> str:
    """
    Mapuje EmailLog + plate_number na ParsedDocument i generuje PDF CMR.
    Zwraca HTML z linkiem do pobrania.
    """
    from app.models.document_schema import ParsedDocument
    from app.services.cmr_generator import generate_cmr_pdf

    doc_data = ParsedDocument(
        document_type="CMR",
        sender_name=offer.sender or "Zleceniodawca",
        sender_address=None,
        receiver_name="Odbiorca",
        receiver_address=None,
        origin=f"{offer.loading_city or ''} {offer.loading_zip or ''}".strip() or None,
        destination=f"{offer.unloading_city or ''} {offer.unloading_zip or ''}".strip() or None,
        cargo_description="Ładunek — szczegóły wg zlecenia",
        weight_kg=float(offer.weight_kg) if offer.weight_kg else None,
        vehicle_plate=plate.upper().strip(),
        price=offer.price,
        currency=offer.currency or "EUR",
    )

    try:
        pdf_path = generate_cmr_pdf(doc_data)
        filename = os.path.basename(pdf_path)
        download_url = f"/static/docs/{filename}"
        route = f"{offer.loading_city} → {offer.unloading_city}"
        price_str = f"{offer.price} {offer.currency}" if offer.price else "uzgodniona"

        return (
            f"Super, wszystko gotowe! 🤝<br>"
            f"Trasa: <b>{route}</b> | Stawka: <b>{price_str}</b> | Auto: <b>{plate.upper()}</b><br><br>"
            f"📄 Twój list przewozowy CMR:<br>"
            f'<a href="{download_url}" target="_blank" '
            f'style="color:#60a5fa;font-weight:bold;text-decoration:underline;">'
            f"⬇️ Pobierz CMR ({filename})</a><br><br>"
            f"Szerokości drogi! 🚛"
        )
    except RuntimeError as e:
        logger.error(f"❌ CMR error: {e}")
        return (
            "Dogadani! 🤝 Niestety mam chwilowy problem techniczny z generowaniem dokumentu — "
            "skontaktuję się telefonicznie żeby dopełnić formalności. Szerokości! 🚛"
        )


# ── Główna funkcja ────────────────────────────────────────────────────────────

def process_driver_message(message: str, db_session: Session, session_id: str = "default") -> str:
    """Przetwarza wiadomość kierowcy i zwraca odpowiedź spedytora AI (może zawierać HTML)."""
    logger.info(f"💬 [{session_id}] {message[:80]}")

    sess = _session(session_id)
    parsed = _extract_intent(message, awaiting_plate=sess["awaiting_plate"])
    intent = parsed["intent"]
    city = parsed.get("city")
    plate = parsed.get("plate_number")

    logger.info(f"🎯 intent={intent} | city={city} | plate={plate}")

    # ── PODAJ_REJESTRACJE → generuj CMR ──────────────────────────────
    if intent == "PODAJ_REJESTRACJE" and plate and sess["last_offer"]:
        sess["awaiting_plate"] = False
        offer = sess["last_offer"]
        return _generate_cmr(offer, plate)

    # ── AKCEPTUJE_LADUNEK → zapytaj o rejestrację ────────────────────
    if intent == "AKCEPTUJE_LADUNEK":
        if sess["last_offer"]:
            sess["awaiting_plate"] = True
            offer = sess["last_offer"]
            route = f"{offer.loading_city} → {offer.unloading_city}"
            return (
                f"Super! Cieszę się, że się dogadaliśmy na trasę <b>{route}</b>. 😊<br>"
                f"Podaj mi jeszcze tylko <b>numer rejestracyjny</b> Twojego auta, "
                f"żebym mógł wystawić CMR-kę. (np. WA 12345)"
            )
        return (
            "Świetnie! 😊 Nie pamiętam jednak której oferty dotyczy Twoja odpowiedź — "
            "napisz mi jeszcze raz z jakiego miasta szukasz ładunku."
        )

    # ── SZUKA_LADUNKU → znajdź i zaproponuj ──────────────────────────
    if intent == "SZUKA_LADUNKU" and city:
        offers = _find_offers(city, db_session)
        logger.info(f"📦 Znaleziono {len(offers)} ofert dla: {city}")
        if offers:
            sess["last_offer"] = offers[0]
            sess["awaiting_plate"] = False
        response = _build_offer_response(message, city, offers)
        return response or f"Sprawdzam ładunki z {city}... 🚛"

    # ── Jeśli czekamy na rejestrację a intencja to INNE ──────────────
    if sess["awaiting_plate"]:
        # Spróbuj wyciągnąć numer rejestracyjny bezpośrednio z tekstu
        plate_match = re.search(r'\b([A-Z]{1,3}[\s\-]?\d{3,5}[A-Z]{0,2})\b', message.upper())
        if plate_match and sess["last_offer"]:
            plate = plate_match.group(1).strip()
            sess["awaiting_plate"] = False
            return _generate_cmr(sess["last_offer"], plate)
        return (
            "Jeszcze potrzebuję <b>numeru rejestracyjnego</b> Twojego auta, "
            "żeby wystawić CMR. Podaj go w formacie np. WA 12345. 🚛"
        )

    # ── Fallback ──────────────────────────────────────────────────────
    fallback = _call_llm(
        f"""Jesteś spedytorem. Kierowca napisał: "{message}"
Odpowiedz krótko, po polsku — zapytaj o lokalizację lub jak możesz pomóc. Max 2 zdania.""",
        max_tokens=120,
    )
    return fallback or "Cześć! W jakiej okolicy jesteś? Chętnie znajdę dla Ciebie ładunek! 🚛"
