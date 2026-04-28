"""
Serwis generowania dokumentów CMR jako PDF za pomocą szablonów HTML (Jinja2) i WeasyPrint.
"""
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime
from app.models.document_schema import ParsedDocument
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

logger = logging.getLogger(__name__)

DOCS_DIR = Path("static/docs")
TEMPLATES_DIR = Path("app/templates")

def _ensure_dirs():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

def generate_cmr_pdf(doc: ParsedDocument) -> str:
    """
    Generuje list przewozowy CMR w formacie PDF na podstawie obiektu ParsedDocument i szablonu HTML.
    """
    _ensure_dirs()

    try:
        # 1. Konfiguracja struktury stron (Czerwona, Niebieska, Zielona, Czarna Kopia)
        pages = [
            {"color": "#e30613", "number": "1", "text": "Egzemplarz dla nadawcy<br>Exemplar fur den Absender<br>Copy for sender"},
            {"color": "#005bb5", "number": "2", "text": "Egzemplarz dla odbiorcy<br>Exemplar fur den Empfanger<br>Copy for consignee"},
            {"color": "#008a00", "number": "3", "text": "Egzemplarz dla przewoznika<br>Exemplar fur den Frachtfuhrer<br>Copy for carrier"},
            {"color": "#000000", "is_copy": True}
        ]

        # 2. Przygotowanie danych do tabeli towarów (jeśli masz listę, iteruj, tu podaję fallback)
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

        # 3. Zmienne wpadające do szablonu HTML
        now_str = datetime.utcnow().strftime("%d/%m/%Y")
        load_date_str = doc.load_date.strftime("%d/%m/%Y") if getattr(doc, 'load_date', None) else now_str

        template_vars = {
            "pages": pages,
            "doc_nr": f"CMR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
            "sender_name": doc.sender_name or "",
            "sender_address": doc.sender_address or "",
            "receiver_name": doc.receiver_name or "",
            "receiver_address": doc.receiver_address or "",
            "carrier_name": "SmartLoad AI", # ew. z doc
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

        # 4. Ładowanie Jinja2 i rendering HTML w pamięci
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
        template = env.get_template("cmr_template.html")
        rendered_html = template.render(template_vars)

        # 5. Zapis z WeasyPrint bezpośrednio do PDF
        filename = f"cmr_{uuid.uuid4().hex[:8]}.pdf"
        filepath = DOCS_DIR / filename
        
        HTML(string=rendered_html).write_pdf(str(filepath))
        
        logger.info(f"✅ Nowoczesny CMR PDF wygenerowany pomyślnie: {filepath}")
        return str(filepath)

    except Exception as e:
        logger.error(f"❌ Błąd generowania CMR PDF: {e}")
        raise RuntimeError(f"Nie udało się wygenerować dokumentu CMR: {e}")