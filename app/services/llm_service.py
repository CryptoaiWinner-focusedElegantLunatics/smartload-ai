import json
import os
import re
from datetime import datetime
import requests
from groq import AsyncGroq
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional

client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])


class ShipmentData(BaseModel):
    sender: Optional[str] = None
    recipient: Optional[str] = None
    cargo_description: Optional[str] = None
    weight_kg: Optional[float] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None

    @field_validator("pickup_date", "delivery_date", mode="before")
    @classmethod
    def validate_date(cls, v):
        """Normalizuje datę do formatu YYYY-MM-DD."""
        if v is None:
            return None
        v = str(v).strip()
        # Próbuj różne formaty wejściowe
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None  # Jeśli żaden format nie pasuje → null

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, v):
        """Ustandaryzuj kod waluty do wielkich liter."""
        if v is None:
            return None
        return str(v).strip().upper()

    @field_validator("weight_kg", "price", mode="before")
    @classmethod
    def parse_numeric(cls, v):
        """Obsłuż liczby zapisane jako string (np. '1 200,50' lub '1200.50')."""
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        # Usuń spacje jako separator tysięcy, zamień przecinek na kropkę
        cleaned = re.sub(r"\s+", "", str(v)).replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return None

    @field_validator("sender", "recipient", "origin", "destination", "cargo_description", mode="before")
    @classmethod
    def strip_strings(cls, v):
        """Usuń zbędne białe znaki z pól tekstowych."""
        if v is None:
            return None
        return str(v).strip() or None

    @model_validator(mode="after")
    def validate_dates_order(self):
        """Sprawdź czy pickup_date <= delivery_date."""
        if self.pickup_date and self.delivery_date:
            if self.pickup_date > self.delivery_date:
                # Zamień daty jeśli są odwrócone
                self.pickup_date, self.delivery_date = self.delivery_date, self.pickup_date
        return self


PROMPT = """
Jesteś asystentem spedycyjnym. Przeanalizuj dokument i zwróć dane jako JSON.
Odpowiedz TYLKO samym JSON-em, zero tekstu dookoła.

Pola:
- sender, recipient, cargo_description, weight_kg,
  origin, destination, pickup_date (YYYY-MM-DD),
  delivery_date (YYYY-MM-DD), price, currency

Jeśli pole nie występuje — wpisz null.

Dokument:
{text}
"""


async def extract_shipment_data(text: str) -> ShipmentData:
    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": PROMPT.format(text=text)}],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    raw = response.choices[0].message.content
    data = json.loads(raw)
    # Pydantic walidatory automatycznie normalizują i mapują dane
    return ShipmentData(**data)

def generate_comparison_message(best_timo: dict, best_internal: dict) -> str:
    """
    Funkcja generująca podsumowanie ofert na czat.
    """
    api_key = os.getenv("OPENROUTER_API_KEY") # lub GROQ_API_KEY w zależności z czego tu korzystasz
    if not api_key:
        return "Znalazłem oferty. Spójrz na zestawienie poniżej."

    timo_text = f"Cena: {best_timo['price']} {best_timo['currency']}, Waga: {best_timo['weight']}t" if best_timo else "Brak ofert na giełdzie TimoCom."
    internal_text = f"Cena: {best_internal['price']} {best_internal['currency']}, Waga: {best_internal['weight']}t" if best_internal else "Brak ofert z naszych maili."

    prompt = f"""Jesteś wirtualnym asystentem spedycyjnym w systemie SmartLoad.
Twoim zadaniem jest doradzić użytkownikowi, która opcja ładunku jest lepsza.
Przeanalizuj dwie najlepsze oferty dla wyszukiwanej trasy:

1. OFERTA Z GIEŁDY TIMOCOM:
{timo_text}

2. OFERTA Z NASZYCH MAILI (Wewnętrzna Baza):
{internal_text}

Napisz krótką, profesjonalną wiadomość na czat (max 3 zdania). 
Zawsze wskazuj, która opcja jest bardziej opłacalna finansowo. 
Używaj naturalnego, branżowego języka (np. fracht, ładunek, giełda). Nie używaj markdowna (* ani #).
"""

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemma-4-26b-a4b-it",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 150
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        return "Znalazłem oferty. Spójrz na zestawienie poniżej."

    except Exception:
        return "Znalazłem oferty. Spójrz na zestawienie poniżej."