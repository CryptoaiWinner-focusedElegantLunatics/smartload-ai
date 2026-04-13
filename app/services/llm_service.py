import json
import os
from groq import AsyncGroq
from pydantic import BaseModel
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
        temperature=0.1  # mniej kreatywności = bardziej przewidywalny JSON
    )
    raw = response.choices[0].message.content
    return ShipmentData(**json.loads(raw))