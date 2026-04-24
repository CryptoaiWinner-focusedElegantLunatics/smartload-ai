"""
Router dla Task 2.2 – pobieranie surowych ofert z giełdy i zarządzanie publikacją.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from typing import Optional
from app.services.exchange_service import OfferAggregator
from app.services.llm_service import generate_comparison_message
from fastapi import APIRouter, Query, Depends
from sqlmodel import Session
from app.core.database import get_session
from app.services.exchange_service import (
    get_raw_offers,
    bulk_publish_loads,
    get_offer_stats,
)

router = APIRouter(prefix="/exchange", tags=["exchange"])


@router.get("/raw-offers")
def fetch_raw_offers(
    session: Session = Depends(get_session),
    limit: int = Query(50, le=200),
    origin: Optional[str] = Query(None, description="Filtruj po mieście załadunku"),
    destination: Optional[str] = Query(None, description="Filtruj po mieście rozładunku"),
    min_price: Optional[float] = Query(None, description="Minimalna cena frachtu"),
    max_price: Optional[float] = Query(None, description="Maksymalna cena frachtu"),
    source: Optional[str] = Query(None, description="Źródło scrapingu (np. cargopedia, trans)"),
):
    """
    Pobiera surowe oferty transportowe z bazy (scraped loads)
    zmapowane na format fireTMS. Główny endpoint dla Task 2.2.
    """
    offers = get_raw_offers(
        session=session,
        limit=limit,
        origin=origin,
        destination=destination,
        min_price=min_price,
        max_price=max_price,
        source=source,
    )
    return {
        "totalItems": len(offers),
        "items": offers,
    }


@router.post("/publish-loads")
def publish_loads_to_exchange(
    session: Session = Depends(get_session),
    limit: int = Query(20, le=100),
    source: Optional[str] = Query(None, description="Publikuj tylko z danego źródła"),
):
    """
    Masowo publikuje scrapowane Loady jako oferty giełdowe.
    Uruchamiać po każdym cyklu scrapera lub ręcznie.
    """
    created_ids = bulk_publish_loads(session=session, limit=limit, source=source)
    return {
        "status": "ok",
        "published": len(created_ids),
        "offerIds": created_ids,
    }


@router.get("/stats")
def exchange_stats(session: Session = Depends(get_session)):
    """Statystyki dla dashboardu – liczba loadów, ofert, źródła."""
    return get_offer_stats(session)

@router.get("/compare")
def compare_offers(
    from_city: str, 
    to_city: str,
    session: Session = Depends(get_session) # 🚨 TUTAJ WSTRZYKUJEMY BAZĘ DO ENDPOINTU!
):
    aggregator = OfferAggregator()
    
    # Przekazujemy wstrzykniętą sesję (session=session) do Agregatora
    results = aggregator.get_comparison(session=session, from_city=from_city, to_city=to_city)
    
    # Generujemy podsumowanie AI
    ai_recommendation = generate_comparison_message(
        results["best_picks"]["timocom"], 
        results["best_picks"]["internal"]
    )
    
    return {
        "chat_response": ai_recommendation,
        "ui_data": {
            "timocom_list": results["lists"]["timocom"],
            "internal_list": results["lists"]["internal"]
        }
    }