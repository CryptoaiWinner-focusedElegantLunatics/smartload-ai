from typing import List, Dict
from sqlmodel import Session
from app.core.database import engine
from app.models.load import Load
from .transporty77 import Transporty77Scraper
from .cargopedia import CargopediaScraper  # ← DODAJ


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

    # Zapis do bazy
    if all_results:
        _save_to_db(all_results)

    return all_results


def _save_to_db(results: List[Dict]):
    with Session(engine) as session:
        saved = 0
        skipped = 0

        for item in results:
            # Pomijamy duplikaty po offer_id
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
            saved += 1

        session.commit()
        print(f"[DB] Zapisano: {saved}, pominięto duplikatów: {skipped}")