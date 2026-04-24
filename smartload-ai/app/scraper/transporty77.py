import httpx
from bs4 import BeautifulSoup
from .base import BaseScraper
from typing import List, Dict
import re


class Transporty77Scraper(BaseScraper):
    source_name = "transporty77.pl"
    BASE_URL = "https://transporty77.pl"

    async def scrape(self) -> List[Dict]:
        results = []

        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
        ) as client:
            resp = await client.get(self.BASE_URL, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pl-PL,pl;q=0.9",
            })
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Każde ogłoszenie to div.box zawierający bloki div.tbl z labelkami
        blocks = soup.select("div.box")
        print(f"[transporty77] Znaleziono bloków: {len(blocks)}")

        for block in blocks:
            try:
                def get_label_value(label: str) -> str:
                    """Znajdź div.tbl gdzie pierwszy .td ma tekst == label,
                       zwróć tekst z drugiego .td"""
                    for tbl in block.select("div.tbl"):
                        tds = tbl.select("div.td")
                        if len(tds) >= 2 and tds[0].get_text(strip=True) == label:
                            return tds[1].get_text(strip=True)
                    return ""

                origin = get_label_value("START")
                destination = get_label_value("STOP")

                # Masa: "TIR » 23,20t 23 200kg" → bierzemy kg
                auto_text = get_label_value("AUTO")
                weight = None
                weight_match = re.search(r"([\d\s]+)kg", auto_text)
                if weight_match:
                    weight = int(weight_match.group(1).replace("\xa0", "").replace(" ", ""))

                # Budżet
                price_raw = get_label_value("BUDŻET")
                price = price_raw if price_raw else None

                # Kategoria
                category = get_label_value("KAT.")

                # ID ogłoszenia
                id_span = block.select_one("span[style*='background:#ff0']")
                offer_id = None
                if id_span:
                    id_match = re.search(r"ID\s*(\d+)", id_span.get_text())
                    if id_match:
                        offer_id = id_match.group(1)

                # Link do ogłoszenia
                contact_link = block.select_one("a.more")
                url = f"{self.BASE_URL}/{contact_link['href']}" if contact_link else None

                if origin and destination:
                    results.append(self.normalize({
                        "title": f"Ładunek {origin} → {destination}",
                        "origin": origin,
                        "destination": destination,
                        "weight_kg": weight,
                        "price_raw": price,
                        "category": category,
                        "offer_id": offer_id,
                        "url": url,
                    }))

            except Exception as e:
                print(f"[transporty77] Błąd bloku: {e}")
                continue

        return results