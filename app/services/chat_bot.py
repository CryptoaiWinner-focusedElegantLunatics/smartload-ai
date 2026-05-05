"""
SmartLoad Chat Bot – silnik AI dla komunikatora kierowców.
Zaktualizowany o asynchroniczną obsługę generowania CMR.
"""
import os
import re
import json
import logging
import asyncio
import requests
from datetime import datetime
from sqlmodel import Session, select, or_
from app.models.email_log import EmailLog

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemma-4-26b-a4b-it"
PROVIDER = {"order": ["Together", "Fireworks", "DeepInfra"]}

_sessions: dict[str, dict] = {}


def _session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"last_offer": None, "awaiting_plate": False}
    return _sessions[session_id]


def _call_llm_sync(prompt: str, max_tokens: int = 300) -> str:
    """Synchroniczna wersja — wywoływana w wątku."""
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


async def _call_llm(prompt: str, max_tokens: int = 300) -> str:
    """Async wrapper — oddelegowuje blokujący requests.post do wątku."""
    return await asyncio.to_thread(_call_llm_sync, prompt, max_tokens)


async def _extract_intent(message: str, awaiting_plate: bool, last_action: str = None) -> dict:
    if not message or not message.strip():
        return {"intent": "INNE", "loading_city": None, "unloading_city": None, "plate_number": None}

    context_hint = ""
    if awaiting_plate:
        context_hint = "WAŻNE: Czekasz teraz na numer rejestracyjny (tablice). Każdy ciąg znaków przypominający numer auta to PODAJ_REJESTRACJE."
    elif last_action == "OFFER_MADE":
        context_hint = "WAŻNE: Właśnie złożyłeś ofertę ładunku. Odpowiedzi typu 'pasuje', 'biorę', 'ok', 'może być' to AKCEPTUJE_LADUNEK."

    prompt = f"""Jesteś logistycznym systemem AI. Skalasyfikuj wiadomość kierowcy.
Zwróć WYŁĄCZNIE JSON: {{"intent": "...", "loading_city": "...", "unloading_city": "...", "plate_number": "...", "driver_query": null}}

Intencje:
- SZUKA_LADUNKU: pyta o wolne trasy / podaje lokalizację
- AKCEPTUJE_LADUNEK: zgadza się na propozycję (synonimy: pasuje mi, biorę to, git, wchodzę w to, ok)
- PODAJ_REJESTRACJE: podaje numer rejestracyjny
- PRZYPISZ_TRASE: prosi o przypisanie trasy do kierowcy (zawiera "daj", "przypisz", "kierowca nr", "dla kierowcy") — wyciągnij driver_query jako tekst (np. "kierowca1", "3", "jan kowalski")
- POKAZ_MOJE_TRASY: pyta o swoje własne, przypisane mu trasy (np. "jakie mam trasy", "moje trasy", "gdzie jadę")
- SPRAWDZ_TRASY_KIEROWCY: spedytor pyta o trasy przypisane do konkretnego kierowcy (np. "jakie trasy ma kierowca 1", "trasy dla kierowcy nr 5") — wyciągnij driver_query jako tekst (np. "kierowca1", "5", "jan kowalski")
- INNE: reszta

Kontekst: {context_hint}
Wiadomość: "{message}"
JSON:"""

    raw = await _call_llm(prompt, max_tokens=100)
    raw = re.sub(r'```json\n?', '', raw)
    raw = re.sub(r'```\n?', '', raw).strip()

    try:
        result = json.loads(raw)
        intent = result.get("intent", "INNE")
        if intent not in ("SZUKA_LADUNKU", "AKCEPTUJE_LADUNEK", "PODAJ_REJESTRACJE", "PRZYPISZ_TRASE", "POKAZ_MOJE_TRASY", "SPRAWDZ_TRASY_KIEROWCY", "INNE"):
            intent = "INNE"
        return {
            "intent": intent,
            "loading_city": result.get("loading_city"),
            "unloading_city": result.get("unloading_city"),
            "plate_number": result.get("plate_number"),
            "driver_query": result.get("driver_query") or result.get("driver_id"),
        }
    except Exception:
        logger.warning(f"⚠️ Nie udało się sparsować intencji: {raw!r}")
        return {"intent": "INNE", "loading_city": None, "unloading_city": None, "plate_number": None}


def _find_offers(loading_city: str, unloading_city: str, db_session: Session) -> list[EmailLog]:
    conditions = [
        EmailLog.is_deleted == False,
        or_(EmailLog.ai_category == "OFERTA", EmailLog.ai_category == "ZAMOWIENIE")
    ]
    if loading_city:
        conditions.append(EmailLog.loading_city.icontains(loading_city))
    if unloading_city:
        conditions.append(EmailLog.unloading_city.icontains(unloading_city))
    query = select(EmailLog).where(*conditions).limit(3)
    return db_session.exec(query).all()


async def _build_offer_response(driver_message: str, city: str, offers: list[EmailLog]) -> str:
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

    return await _call_llm(prompt, max_tokens=250)


async def _generate_cmr(offer: EmailLog, plate: str, driver_id: int | None = None) -> str:
    """Tworzy CMR + AssignedRoute (żeby trasa pojawiła się w my-routes)."""
    from app.models.document_schema import ParsedDocument
    from app.services.cmr_generator import generate_cmr_pdf

    doc_data = ParsedDocument(
        document_type="CMR",
        sender_name=offer.sender or "SmartLoad Partner",
        sender_address="Giełda Transportowa",
        receiver_name=offer.unloading_city or "Odbiorca",
        receiver_address="Adres Odbiorcy",
        origin=f"{offer.loading_city or ''} {offer.loading_zip or ''}".strip() or None,
        destination=f"{offer.unloading_city or ''} {offer.unloading_zip or ''}".strip() or None,
        weight_kg=float(offer.weight_kg) if offer.weight_kg else None,
        vehicle_plate=plate.upper().strip(),
        price=offer.price,
        currency=offer.currency or "EUR",
    )

    try:
        pdf_path = await generate_cmr_pdf(doc_data)
        filename = os.path.basename(pdf_path)
        download_url = f"/static/docs/{filename}"
        route_str = f"{offer.loading_city} → {offer.unloading_city}"
        price_str = f"{offer.price} {offer.currency}" if offer.price else "uzgodniona"

        # Zapisz trasę w bazie (żeby kierowca widział ją w my-routes)
        if driver_id:
            try:
                from app.models.assigned_route import AssignedRoute
                from app.core.database import engine
                from sqlmodel import Session as Sess

                with Sess(engine) as s:
                    ar = AssignedRoute(
                        driver_id=driver_id,
                        source_id=f"chat_offer_{offer.id}",
                        loading_city=offer.loading_city or "?",
                        unloading_city=offer.unloading_city or "?",
                        weight_kg=float(offer.weight_kg or 0),
                        price=float(offer.price or 0),
                        status="PRZYPISANE",
                        cmr_path=pdf_path,
                    )
                    s.add(ar)
                    s.commit()
                    logger.info(f"✅ AssignedRoute utworzony dla kierowcy {driver_id}")
            except Exception as e:
                logger.warning(f"⚠️ Nie udało się utworzyć AssignedRoute: {e}")

        return (
            f"Super, wszystko gotowe! 🤝<br>"
            f"Trasa: <b>{route_str}</b> | Stawka: <b>{price_str}</b> | Auto: <b>{plate.upper()}</b><br><br>"
            f"📄 Twój list przewozowy CMR:<br>"
            f'<a href="{download_url}" target="_blank" '
            f'style="color:#60a5fa;font-weight:bold;text-decoration:underline;">'
            f"⬇️ Pobierz CMR ({filename})</a><br><br>"
            f"Trasa została dodana do panelu <b>Moje Trasy</b>. Szerokości drogi! 🚛"
        )
    except Exception as e:
        logger.error(f"❌ CMR error: {e}")
        return (
            "Dogadani! 🤝 Niestety mam chwilowy problem techniczny z generowaniem dokumentu — "
            "skontaktuję się telefonicznie żeby dopełnić formalności. Szerokości! 🚛"
        )


async def process_driver_message(message: str, db_session: Session, session_id: str = "default", driver_id: int | None = None, user_role: str | None = None) -> str:
    """Główna logika czatu - teraz asynchroniczna, aby nie blokować serwera."""
    sess = _session(session_id)
    last_action = "OFFER_MADE" if sess.get("last_offer") else None
    parsed = await _extract_intent(message, sess["awaiting_plate"], last_action)
    intent = parsed["intent"]
    loading_city = parsed.get("loading_city")
    unloading_city = parsed.get("unloading_city")
    plate = parsed.get("plate_number")
    driver_query = parsed.get("driver_query")

    logger.info(f"🎯 intent={intent} | loading={loading_city} | unloading={unloading_city} | plate={plate} | driver_query={driver_query} | role={user_role}")

    # Zablokuj kierowcom dostęp do funkcji spedytora
    if user_role == "KIEROWCA" and intent in ("SZUKA_LADUNKU", "AKCEPTUJE_LADUNEK", "PRZYPISZ_TRASE", "SPRAWDZ_TRASY_KIEROWCY"):
        return "Jako kierowca masz dostęp tylko do podglądu swoich tras. Opcje wyszukiwania i przypisywania ładunków są zarezerwowane dla spedytorów. Wpisz np. \"Pokaż moje trasy.\""

    # ── PRZYPISZ_TRASE → przypisz ofertę do kierowcy i powiadom ─────
    if intent == "PRZYPISZ_TRASE":
        offer = sess.get("last_offer")
        if not offer:
            return "Nie pamiętam żadnej omawianej oferty. Najpierw powiedz mi skąd szukasz ładunku."

        # Fallback: szukaj driver_query z regex jeśli LLM nie wyciągnął
        if not driver_query:
            m = re.search(r'(?:kierowca?|driver)\s*([^\s]+)', message, re.IGNORECASE)
            driver_query = m.group(1) if m else None

        if not driver_query:
            return "Podaj nazwę lub ID kierowcy (np. 'daj tę trasę kierowcy nr 3' lub 'przypisz do kierowca1')."

        try:
            from app.models.user import User, UserRole
            from app.models.assigned_route import AssignedRoute
            from app.core.database import engine
            from sqlmodel import Session as Sess, select, or_

            with Sess(engine) as s:
                conditions = [User.username.ilike(f"%{driver_query}%")]
                if driver_query.isdigit():
                    conditions.append(User.id == int(driver_query))
                
                driver = s.exec(select(User).where(or_(*conditions))).first()
                if not driver or driver.role != UserRole.KIEROWCA:
                    return f"Nie znalazłem kierowcy '{driver_query}' w systemie."

                route = AssignedRoute(
                    driver_id=driver.id,
                    source_id=f"chat_offer_{offer.id}",
                    loading_city=offer.loading_city or "?",
                    unloading_city=offer.unloading_city or "?",
                    weight_kg=float(offer.weight_kg or 0),
                    price=float(offer.price or 0),
                    status="PRZYPISANE",
                )
                s.add(route)
                s.commit()
                s.refresh(route)
                route_id = route.id

            # Wyślij powiadomienie Pusher do kierowcy
            try:
                from app.core.pusher_client import pusher_client
                pusher_client.trigger(
                    f"private-user-{driver.id}",
                    "new-message",
                    {
                        "type": "notification",
                        "content": f"🚛 Nowa trasa: {offer.loading_city} → {offer.unloading_city}. Sprawdź Moje Trasy.",
                    },
                )
            except Exception as e:
                logger.warning(f"⚠️ Pusher notify failed: {e}")

            sess["last_offer"] = None
            route_str = f"{offer.loading_city} → {offer.unloading_city}"
            return (
                f"Jasne! ✅ Trasa <b>{route_str}</b> została przypisana do kierowcy "
                f"<b>{driver.username}</b> (ID: {driver.id}).<br>"
                f"Wysłałem mu powiadomienie o nowej trasie. Możesz to sprawdzić w panelu Moje Trasy."
            )
        except Exception as e:
            logger.error(f"❌ assign_route error: {e}", exc_info=True)
            return "Wystąpił błąd przy przypisywaniu trasy. Spróbuj ponownie."

    # ── PODAJ_REJESTRACJE → generuj CMR ──────────────────────────────
    if intent == "PODAJ_REJESTRACJE" and plate and sess.get("last_offer"):
        sess["awaiting_plate"] = False
        return await _generate_cmr(sess["last_offer"], plate, driver_id=driver_id)

    # ── AKCEPTUJE_LADUNEK → zapytaj o rejestrację ────────────────────
    if intent == "AKCEPTUJE_LADUNEK":
        if sess.get("last_offer"):
            # Sprawdź czy wiadomość zawiera konkretne ID oferty (#123)
            id_match = re.search(r'#(\d+)', message)
            if id_match:
                offer_id = int(id_match.group(1))
                # Znajdź konkretną ofertę w liście
                all_offers = sess.get("all_offers", [sess["last_offer"]])
                matched = next((o for o in all_offers if o.id == offer_id), None)
                if matched:
                    sess["last_offer"] = matched

            sess["awaiting_plate"] = True
            offer = sess["last_offer"]
            route = f"{offer.loading_city} → {offer.unloading_city}"
            return (
                f"Świetnie! 🤝 Rezerwuję trasę <b>{route}</b>.<br>"
                f"Podaj mi jeszcze <b>numer rejestracyjny</b> Twojego auta do wystawienia CMR-ki (np. WA 12345)."
            )
        else:
            return "Super, że jesteś chętny! Przypomnij mi tylko, z jakiego miasta szukasz wyjazdu? 🚛"

    # ── SZUKA_LADUNKU → znajdź i zwróć kartę oferty (JSON) ───────────
    if intent == "SZUKA_LADUNKU" and loading_city:
        offers = _find_offers(loading_city, unloading_city, db_session)
        logger.info(f"📦 Znaleziono {len(offers)} ofert dla: {loading_city}")

        if offers:
            # Zapamiętaj pierwszą ofertę jako "last_offer" dla akcji akceptuj/przypisz
            sess["last_offer"] = offers[0]
            sess["all_offers"] = offers  # lista do wyboru
            sess["awaiting_plate"] = False
            text = await _build_offer_response(message, loading_city, offers)

            offer_cards = []
            for o in offers:
                offer_cards.append({
                    "id": f"#{o.id}",
                    "route_from": o.loading_city or "?",
                    "route_to": o.unloading_city or "?",
                    "price": f"{o.price} {o.currency}" if o.price else "do ustalenia",
                    "weight": f"{o.weight_kg} kg" if o.weight_kg else "?",
                })

            payload = {
                "type": "offer_card",
                "message": text or f"Znalazłem coś dla Ciebie z {loading_city}!",
                "offers": offer_cards,
                "offer": offer_cards[0],  # backwards compat
            }
            return json.dumps(payload, ensure_ascii=False)
        else:
            return (await _build_offer_response(message, loading_city, [])) or f"Niestety brak ofert z {loading_city} 😔 Odezwę się jak coś się pojawi!"

    # ── POKAZ_MOJE_TRASY ──────────────────────────────────────────────
    if intent == "POKAZ_MOJE_TRASY":
        if not driver_id:
            return "Nie jestem w stanie zidentyfikować Twojego konta. Zaloguj się poprawnie, aby zobaczyć swoje trasy."
        try:
            from app.models.assigned_route import AssignedRoute
            from app.core.database import engine
            from sqlmodel import Session as Sess, select
            
            with Sess(engine) as s:
                routes = s.exec(select(AssignedRoute).where(AssignedRoute.driver_id == driver_id)).all()
                if not routes:
                    return "Nie masz aktualnie żadnych przypisanych tras. Szerokości! 🚛"
                
                route_list = []
                for r in routes:
                    route_list.append({
                        "id": r.id,
                        "loading_city": r.loading_city,
                        "unloading_city": r.unloading_city,
                        "status": r.status,
                        "cmr_link": f"/api/backend/api/routes/{r.id}/cmr" if r.cmr_path else None,
                        "weight_kg": r.weight_kg,
                        "price": r.price,
                        "source_id": r.source_id,
                        "assigned_at": r.assigned_at.isoformat() if r.assigned_at else None
                    })
                    
                payload = {
                    "type": "assigned_routes",
                    "message": "Twoje przypisane trasy to:",
                    "routes": route_list
                }
                return json.dumps(payload, ensure_ascii=False)
        except Exception as e:
            logger.error(f"❌ POKAZ_MOJE_TRASY error: {e}", exc_info=True)
            return "Wystąpił błąd podczas pobierania tras."

    # ── SPRAWDZ_TRASY_KIEROWCY ────────────────────────────────────────
    if intent == "SPRAWDZ_TRASY_KIEROWCY":
        if not driver_query:
            m = re.search(r'(?:kierowca?|driver)\s*([^\s]+)', message, re.IGNORECASE)
            driver_query = m.group(1) if m else None

        if not driver_query:
            return "Podaj nazwę lub ID kierowcy, którego trasy chcesz sprawdzić (np. 'pokaż trasy kierowca1' lub 'kierowcy nr 3')."
        try:
            from app.models.user import User
            from app.models.assigned_route import AssignedRoute
            from app.core.database import engine
            from sqlmodel import Session as Sess, select, or_
            
            with Sess(engine) as s:
                conditions = [User.username.ilike(f"%{driver_query}%")]
                if driver_query.isdigit():
                    conditions.append(User.id == int(driver_query))
                
                driver = s.exec(select(User).where(or_(*conditions))).first()
                if not driver:
                    return f"Nie znalazłem kierowcy '{driver_query}' w systemie."
                    
                routes = s.exec(select(AssignedRoute).where(AssignedRoute.driver_id == driver.id)).all()
                if not routes:
                    return f"Kierowca <b>{driver.username}</b> (ID: {driver.id}) nie ma aktualnie przypisanych tras."
                
                route_list = []
                for r in routes:
                    route_list.append({
                        "id": r.id,
                        "loading_city": r.loading_city,
                        "unloading_city": r.unloading_city,
                        "status": r.status,
                        "cmr_link": f"/api/backend/api/routes/{r.id}/cmr" if r.cmr_path else None,
                        "weight_kg": r.weight_kg,
                        "price": r.price,
                        "source_id": r.source_id,
                        "assigned_at": r.assigned_at.isoformat() if r.assigned_at else None
                    })
                    
                payload = {
                    "type": "assigned_routes",
                    "message": f"Trasy przypisane do kierowcy **{driver.username}** (ID: {driver.id}):",
                    "routes": route_list
                }
                return json.dumps(payload, ensure_ascii=False)
        except Exception as e:
            logger.error(f"❌ SPRAWDZ_TRASY_KIEROWCY error: {e}", exc_info=True)
            return "Wystąpił błąd podczas pobierania tras kierowcy."

    # ── Czekamy na tablice, ale LLM sklasyfikował INNE ───────────────
    if sess["awaiting_plate"]:
        plate_match = re.search(r'\b([A-Z]{1,3}[\s\-]?\d{3,5}[A-Z]{0,2})\b', message.upper())
        if plate_match and sess["last_offer"]:
            plate = plate_match.group(1).strip()
            sess["awaiting_plate"] = False
            return await _generate_cmr(sess["last_offer"], plate)
        return (
            "Jeszcze potrzebuję <b>numeru rejestracyjnego</b> Twojego auta, "
            "żeby wystawić CMR. Podaj go w formacie np. WA 12345. 🚛"
        )

    # ── Fallback ──────────────────────────────────────────────────────
    fallback = await _call_llm(
        f"""Jesteś spedytorem. Kierowca napisał: "{message}"
Odpowiedz krótko, po polsku — zapytaj o lokalizację lub jak możesz pomóc. Max 2 zdania.""",
        max_tokens=120,
    )
    return fallback or "Cześć! W jakiej okolicy jesteś? Chętnie znajdę dla Ciebie ładunek! 🚛"