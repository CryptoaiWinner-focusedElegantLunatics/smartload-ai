"""
Serwis integracyjny – Task 2.2
Pobiera surowe oferty (Load) z bazy i mapuje je na format fireTMS (Offer).
Stanowi warstwę pośrednią między scraperem a resztą aplikacji (AI, frontend).
"""
from typing import Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select

from app.models.load import Load
from app.models.offer import (
    CreateOfferDto,
    CreateOfferResponse,
    OfferRecord,
    PublicApiOfferDto,
    PublicApiOfferCargoHandling,
    PublicApiPublicationOnExchangeDetailsDto,
    PublicApiPaymentDetailsDto,
    MoneyDto,
)

# Import in-memory offer store z routera (single source of truth)
from app.api.offers import _offers
import uuid


# ---------------------------------------------------------------------------
# Mapowanie Load → PublicApiOfferDto (format fireTMS)
# ---------------------------------------------------------------------------

def load_to_offer_dto(load: Load) -> PublicApiOfferDto:
    """
    Konwertuje scraped Load na ofertę w formacie fireTMS.
    Używane zarówno do zwracania surowych ofert jak i publikowania na giełdę.
    """
    expire_date = (datetime.utcnow() + timedelta(days=3)).isoformat()

    loading_spot = PublicApiOfferCargoHandling(
        city=_extract_city(load.origin),
        country=_extract_country(load.origin),
        type="LOADING",
        date=load.scraped_at.isoformat() if load.scraped_at else None,
    )

    unload_spot = PublicApiOfferCargoHandling(
        city=_extract_city(load.destination),
        country=_extract_country(load.destination),
        type="UNLOADING",
    )

    price = None
    if load.price:
        price = MoneyDto(amount=load.price, currencyCode="EUR")

    cargos = []
    if load.weight_kg or load.category:
        cargos.append({
            "description": load.title or load.category or "Ładunek",
            "weightKg": load.weight_kg,
            "cargoType": load.category,
        })

    return PublicApiOfferDto(
        externalId=load.offer_id or f"LOAD-{load.id}",
        description=load.title or f"{load.origin} → {load.destination}",
        expireDate=expire_date,
        price=price,
        loadingSpot=loading_spot,
        unloadSpot=unload_spot,
        cargos=cargos if cargos else None,
        semitrailerType=_guess_semitrailer_type(load.category),
    )


# ---------------------------------------------------------------------------
# Główne funkcje serwisu
# ---------------------------------------------------------------------------

def get_raw_offers(
    session: Session,
    limit: int = 50,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    source: Optional[str] = None,
) -> list[dict]:
    """
    Zwraca surowe oferty z bazy (scraped Loads) zmapowane na format fireTMS.
    To jest główna funkcja dla Task 2.2 – źródło danych dla AI i frontendu.
    """
    query = select(Load)

    if origin:
        query = query.where(Load.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.where(Load.destination.ilike(f"%{destination}%"))
    if min_price is not None:
        query = query.where(Load.price >= min_price)
    if max_price is not None:
        query = query.where(Load.price <= max_price)
    if source:
        query = query.where(Load.source == source)

    query = query.limit(limit)
    loads = session.exec(query).all()

    return [
        {
            "loadId": load.id,
            "source": load.source,
            "scrapedAt": load.scraped_at.isoformat() if load.scraped_at else None,
            "offer": load_to_offer_dto(load).dict(),
        }
        for load in loads
    ]


def publish_load_as_offer(
    load: Load,
    publish_on_exchange: bool = True,
    payment_days: int = 30,
) -> OfferRecord:
    """
    Tworzy ofertę giełdową na podstawie scraped Load i zapisuje w store.
    Symuluje POST /offers z fireTMS.
    """
    offer_dto = load_to_offer_dto(load)

    exchange_details = PublicApiPublicationOnExchangeDetailsDto(
        publishOnFireXgo=publish_on_exchange,
        paymentDetails=PublicApiPaymentDetailsDto(
            paymentDays=payment_days,
            paymentType="DAYS_FROM_INVOICE",
        ),
    )

    new_id = str(uuid.uuid4())
    record = OfferRecord(
        id=new_id,
        offer=offer_dto,
        exchangeDetails=exchange_details,
        status="ACTIVE",
        createdAt=datetime.utcnow().isoformat(),
        publications={},
    )
    _offers[new_id] = record
    return record


def bulk_publish_loads(
    session: Session,
    limit: int = 20,
    source: Optional[str] = None,
) -> list[str]:
    """
    Masowo publikuje scrapowane Loady jako oferty giełdowe.
    Zwraca listę ID stworzonych ofert.
    Przydatne do uruchomienia po każdym cyklu scrapera.
    """
    query = select(Load)
    if source:
        query = query.where(Load.source == source)
    query = query.limit(limit)

    loads = session.exec(query).all()
    created_ids = []

    for load in loads:
        # Nie duplikuj jeśli oferta dla tego loadu już istnieje
        existing = _find_offer_by_external_id(f"LOAD-{load.id}")
        if existing:
            continue
        record = publish_load_as_offer(load)
        created_ids.append(record.id)

    return created_ids


def get_offer_stats(session: Session) -> dict:
    """Zwraca statystyki dla dashboardu."""
    all_loads = session.exec(select(Load)).all()
    active_offers = [o for o in _offers.values() if o.status == "ACTIVE"]

    sources = {}
    for load in all_loads:
        src = load.source or "unknown"
        sources[src] = sources.get(src, 0) + 1

    return {
        "totalLoads": len(all_loads),
        "activeOffers": len(active_offers),
        "loadsBySource": sources,
        "lastUpdated": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Helpery prywatne
# ---------------------------------------------------------------------------

def _extract_city(location: str) -> Optional[str]:
    """Próbuje wyciągnąć miasto z stringa lokalizacji (np. 'Katowice, PL' → 'Katowice')"""
    if not location:
        return None
    return location.split(",")[0].strip()


def _extract_country(location: str) -> Optional[str]:
    """Próbuje wyciągnąć kod kraju z stringa lokalizacji (np. 'Katowice, PL' → 'PL')"""
    if not location:
        return None
    parts = location.split(",")
    if len(parts) >= 2:
        return parts[-1].strip().upper()
    return "PL"  # domyślnie Polska


def _guess_semitrailer_type(category: Optional[str]) -> Optional[list[str]]:
    """Zgaduje typ naczepy na podstawie kategorii ładunku."""
    if not category:
        return ["CURTAINSIDER"]
    cat = category.lower()
    if any(w in cat for w in ["chłod", "mroz", "refrig", "cold", "frozen"]):
        return ["REFRIGERATOR"]
    if any(w in cat for w in ["cystern", "liquid", "plyn"]):
        return ["TANKER"]
    if any(w in cat for w in ["drewno", "timber", "wood", "steel", "stal"]):
        return ["FLATBED"]
    return ["CURTAINSIDER"]


def _find_offer_by_external_id(external_id: str) -> Optional[OfferRecord]:
    """Sprawdza czy oferta z danym externalId już istnieje."""
    for offer in _offers.values():
        if offer.offer and isinstance(offer.offer, dict):
            if offer.offer.get("externalId") == external_id:
                return offer
        elif offer.offer and hasattr(offer.offer, "externalId"):
            if offer.offer.externalId == external_id:
                return offer
    return None
