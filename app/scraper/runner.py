from typing import List, Dict
from sqlmodel import Session
from app.core.database import engine
from app.models.load import Load
from .transporty77 import Transporty77Scraper
from .cargopedia import CargopediaScraper


async def run_all_scrapers() -> List[Dict]:
    scrapers = [
        Transporty77Scraper(),
        CargopediaScraper(),
    ]
    all_results = []
    for scraper in scrapers:
        try:
            data = await scraper.scrape()
            print(f"[{scraper.source_name}] Pobrano {len(data)} ogłoszeń")
            all_results.extend(data)
        except Exception as e:
            print(f"[{scraper.source_name}] Błąd scrapowania: {e}")

    if all_results:
        saved_ids = _save_to_db(all_results)
        _publish_new_loads(saved_ids)

    return all_results


def _save_to_db(results: List[Dict]) -> List[int]:
    """Zapisuje nowe Loady do bazy, zwraca listę ID nowo zapisanych."""
    saved_ids = []
    with Session(engine) as session:
        saved = 0
        skipped = 0
        for item in results:
            if item.get("offer_id"):
                existing = session.query(Load).filter_by(
                    offer_id=item["offer_id"],
                    source=item["source"]
                ).first()
                if existing:
                    skipped += 1
                    continue
            load = Load(**item)
            session.add(load)
            session.flush()  # żeby mieć load.id przed commitem
            saved_ids.append(load.id)
            saved += 1
        session.commit()
        print(f"[DB] Zapisano: {saved}, pominięto duplikatów: {skipped}")
    return saved_ids


def _publish_new_loads(load_ids: List[int]):
    """Publikuje nowo zapisane Loady jako oferty giełdowe."""
    if not load_ids:
        return
    try:
        from app.services.exchange_service import publish_load_as_offer
        with Session(engine) as session:
            published = 0
            for load_id in load_ids:
                load = session.get(Load, load_id)
                if load:
                    publish_load_as_offer(load)
                    published += 1
            print(f"[Exchange] Opublikowano {published} nowych ofert")
    except Exception as e:
        print(f"[Exchange] Błąd publikacji ofert: {e}")
