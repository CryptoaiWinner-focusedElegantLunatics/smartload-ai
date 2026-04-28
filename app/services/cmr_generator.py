"""
Serwis generowania dokumentów CMR jako PDF za pomocą szablonów HTML (Jinja2) i WeasyPrint.
"""
import os
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from app.models.document_schema import ParsedDocument
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

logger = logging.getLogger(__name__)

# KULOODPORNE ŚCIEŻKI ABSOLUTNE
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
DOCS_DIR = BASE_DIR / "static" / "docs"

def _ensure_dirs():
    """Upewnia się, że foldery na dokumenty istnieją."""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

def _generate_cmr_pdf_sync(doc: ParsedDocument) -> str:
    """
    Synchroniczna (blokująca) funkcja wykonująca faktyczne renderowanie PDF.
    Wywoływana w osobnym wątku przez asyncio.to_thread.
    """
    _ensure_dirs()

    try:
        # Konfiguracja stron CMR (Czerwona, Niebieska, Zielona, Czarna Kopia)
        pages = [
            {"color": "#e30613", "number": "1", "text": "Egzemplarz dla nadawcy<br>Exemplar fur den Absender<br>Copy for sender"},
            {"color": "#005bb5", "number": "2", "text": "Egzemplarz dla odbiorcy<br>Exemplar fur den Empfanger<br>Copy for consignee"},
            {"color": "#008a00", "number": "3", "text": "Egzemplarz dla przewoznika<br>Exemplar fur den Frachtfuhrer<br>Copy for carrier"},
            {"color": "#000000", "is_copy": True}
        ]

        # Przygotowanie danych towarów
        items = []
        if getattr(doc, 'cargo_description', None):
            items.append({
                "marks": "",
                "packages": "1",
                "method": "Luzem/Paleta",
                "nature": doc.cargo_description,
                "stat_no": "",
                "weight": f"{doc.weight_kg:,.0f}" if doc.weight_kg else "",
                "volume": ""
            })

        now_str = datetime.utcnow().strftime("%d/%m/%Y")
        load_date_str = doc.load_date.strftime("%d/%m/%Y") if getattr(doc, 'load_date', None) else now_str

        template_vars = {
            "pages": pages,
            "doc_nr": f"CMR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
            "sender_name": doc.sender_name or "",
            "sender_address": doc.sender_address or "",
            "receiver_name": doc.receiver_name or "",
            "receiver_address": doc.receiver_address or "",
            "carrier_name": "SmartLoad AI",
            "carrier_address": "Polska",
            "vehicle_plate": doc.vehicle_plate or "",
            "destination": doc.destination or "",
            "origin": doc.origin or "",
            "load_date": load_date_str,
            "attached_docs": "",
            "successive_carrier": "",
            "carrier_remarks": "",
            "items": items,
            "adr_class": "",
            "adr_number": "",
            "adr_letter": "",
            "adr_adr": "",
            "sender_instructions": "",
            "payment_instructions": "Przewozne zapłacone",
            "special_agreements": "",
            "charges": {
                "sender_freight": f"{doc.price}" if getattr(doc, 'price', None) else "",
                "receiver_freight": ""
            },
            "currency": getattr(doc, 'currency', "PLN"),
            "issue_place": "Internet",
            "issue_date": now_str,
            "cod_amount": ""
        }

        # Ładowanie szablonu
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
        template = env.get_template("cmr_template.html")
        rendered_html = template.render(template_vars)

        # Generowanie PDF
        filename = f"cmr_{uuid.uuid4().hex[:8]}.pdf"
        filepath = DOCS_DIR / filename
        
        HTML(string=rendered_html).write_pdf(str(filepath))
        
        logger.info(f"✅ CMR PDF wygenerowany: {filepath}")
        return str(filepath)

    except Exception as e:
        logger.error(f"❌ Błąd w synchronizacji WeasyPrint: {e}", exc_info=True)
        raise RuntimeError(f"Błąd WeasyPrint: {e}")

async def generate_cmr_pdf(doc: ParsedDocument) -> str:
    """
    ASYNC Wrapper: Zapobiega zawieszaniu serwera przez oddelegowanie pracy do wątku.
    """
    return await asyncio.to_thread(_generate_cmr_pdf_sync, doc)