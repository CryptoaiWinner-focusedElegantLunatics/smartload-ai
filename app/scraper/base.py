from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime, timezone


class BaseScraper(ABC):
    source_name: str = "unknown"

    @abstractmethod
    async def scrape(self) -> List[Dict]:
        pass

    def normalize(self, data: Dict) -> Dict:
        """Ujednolica dane z każdego scrapera przed zapisem do bazy."""
        
        # Parsowanie ceny — wyciągamy liczbę z tekstu np. "1500 euro", "2 000 PLN"
        price = None
        price_raw = data.get("price_raw", "")
        if price_raw:
            cleaned = price_raw.replace("\xa0", "").replace(" ", "").replace(",", ".")
            import re
            match = re.search(r"[\d.]+", cleaned)
            if match:
                try:
                    price = float(match.group())
                except ValueError:
                    pass

        return {
            "title":       data.get("title"),
            "origin":      data.get("origin", ""),
            "destination": data.get("destination", ""),
            "weight_kg":   data.get("weight_kg"),
            "price":       price,
            "price_raw":   price_raw or None,
            "category":    data.get("category"),
            "offer_id":    str(data.get("offer_id")) if data.get("offer_id") else None,
            "url":         data.get("url"),
            "source":      self.source_name,
            "scraped_at":  datetime.now(timezone.utc),
        }