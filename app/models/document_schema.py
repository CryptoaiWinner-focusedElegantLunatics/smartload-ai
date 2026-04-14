# app/models/document_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import date

class ParsedDocument(BaseModel):
    # Nadawca
    sender_name: Optional[str] = None
    sender_address: Optional[str] = None
    sender_nip: Optional[str] = None

    # Odbiorca
    receiver_name: Optional[str] = None
    receiver_address: Optional[str] = None

    # Towar
    cargo_description: Optional[str] = None
    weight_kg: Optional[float] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None        # "paleta", "karton" itp.

    # Transport
    load_date: Optional[date] = None
    delivery_date: Optional[date] = None
    vehicle_plate: Optional[str] = None
    incoterms: Optional[str] = None   # EXW, DAP, FCA...
    origin: Optional[str] = None
    destination: Optional[str] = None

    # Finansowe
    price: Optional[float] = None
    currency: Optional[str] = "PLN"

    # Meta
    document_type: Optional[str] = None  # "zlecenie", "CMR", "faktura"
    raw_text: Optional[str] = None        # zawsze zachowaj oryginał