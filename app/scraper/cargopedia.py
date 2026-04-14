# app/scraper/cargopedia.py
import httpx
from bs4 import BeautifulSoup
from .base import BaseScraper
from typing import List, Dict
import re


class CargopediaScraper(BaseScraper):
    source_name = "cargopedia.pl"
    LIST_URL = "https://www.cargopedia.pl"

    async def scrape(self) -> List[Dict]:
        results = []

        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
        ) as client:
            resp = await client.get(self.LIST_URL, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "pl-PL,pl;q=0.9",
            })
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        blocks = soup.select("div.body")
        print(f"[cargopedia] Znaleziono bloków: {len(blocks)}")

        for block in blocks:
            try:
                # Origin
                origin_div = block.select_one("div.localitate.plecare div.rand1")
                origin = origin_div.get_text(strip=True) if origin_div else ""

                # Destination
                dest_div = block.select_one("div.localitate.sosire div.rand1")
                destination = dest_div.get_text(strip=True) if dest_div else ""

                if not origin or not destination:
                    continue

                # Waga
                weight = None
                tonaj = block.select_one("div.tonaj")
                if tonaj:
                    weight_match = re.search(r"[\d.,]+", tonaj.get_text())
                    if weight_match:
                        weight = float(weight_match.group().replace(",", ".")) * 1000  # t → kg

                # Cena
                price_raw = None
                price_div = block.select_one("div.price-container")
                if price_div:
                    price_text = price_div.get_text(strip=True)
                    if price_text:
                        price_raw = price_text

                # Dystans
                distance_div = block.select_one("div.distanta")
                distance = distance_div.get_text(strip=True) if distance_div else ""

                # Link — cargopedia nie ma bezpośredniego linka w bloku,
                # używamy unikalnego hash z datetime
                date_tag = block.select_one("time.timeago")
                offer_id = date_tag["datetime"] if date_tag else None

                results.append(self.normalize({
                    "title": f"Ładunek {origin} → {destination} ({distance})",
                    "origin": origin,
                    "destination": destination,
                    "weight_kg": weight,
                    "price_raw": price_raw,
                    "offer_id": offer_id,
                    "url": self.LIST_URL,
                    "category": block.select_one("span.tipcamion span") and
                                block.select_one("span.tipcamion span").get_text(strip=True),
                }))

            except Exception as e:
                print(f"[cargopedia] Błąd bloku: {e}")
                continue

        return results