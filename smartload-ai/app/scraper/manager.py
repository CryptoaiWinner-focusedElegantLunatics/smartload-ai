from .transporty77 import Transporty77Scraper
from typing import List, Dict


async def run_all_scrapers() -> List[Dict]:
    scrapers = [
        Transporty77Scraper(),
    ]
    results = []
    for scraper in scrapers:
        try:
            data = await scraper.scrape()
            results.extend(data)
        except Exception as e:
            print(f"[{scraper.source_name}] Błąd scrapowania: {e}")
    return results