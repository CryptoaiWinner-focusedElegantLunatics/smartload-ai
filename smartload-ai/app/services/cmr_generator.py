"""
Serwis generowania dokumentów CMR (list przewozowy) jako PDF.
Używa biblioteki reportlab z czcionką DejaVuSans (pełna obsługa Unicode/polskich znaków).
"""
import os
import uuid
import logging
import urllib.request
from pathlib import Path
from datetime import datetime
from app.models.document_schema import ParsedDocument
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

logger = logging.getLogger(__name__)

DOCS_DIR  = Path("static/docs")
FONTS_DIR = Path("static/fonts")

# Sprawdzamy najpierw czcionki systemowe (dostępne w kontenerze Debian/Ubuntu)
_SYSTEM_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]

# Fallback — pobieramy z sieci jeśli brak systemowych
_FONT_URLS = {
    "DejaVuSans.ttf": [
        "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2",
        "https://sourceforge.net/projects/dejavu/files/dejavu/2.37/dejavu-fonts-ttf-2.37.tar.bz2",
    ],
}

FONT_PATH      = FONTS_DIR / "DejaVuSans.ttf"
FONT_BOLD_PATH = FONTS_DIR / "DejaVuSans-Bold.ttf"


def _ensure_dirs():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    FONTS_DIR.mkdir(parents=True, exist_ok=True)


def _ensure_fonts():
    """
    Szuka czcionek DejaVuSans w kolejności:
    1. static/fonts/ (już pobrane wcześniej)
    2. Ścieżki systemowe kontenera (Debian/Ubuntu)
    3. Pobieranie przez apt-get
    """
    if FONT_PATH.exists() and FONT_BOLD_PATH.exists():
        return  # już mamy

    # Sprawdź ścieżki systemowe
    for candidate in _SYSTEM_FONT_CANDIDATES:
        p = Path(candidate)
        if p.exists():
            if "Bold" not in p.name and not FONT_PATH.exists():
                import shutil
                shutil.copy(p, FONT_PATH)
                logger.info(f"✅ Skopiowano czcionkę systemową: {p}")
            elif "Bold" in p.name and not FONT_BOLD_PATH.exists():
                import shutil
                shutil.copy(p, FONT_BOLD_PATH)
                logger.info(f"✅ Skopiowano czcionkę systemową (Bold): {p}")

    if FONT_PATH.exists() and FONT_BOLD_PATH.exists():
        return

    # Ostatnia deska ratunku — apt-get w kontenerze
    logger.warning("⚠️  Czcionki nie znalezione. Próbuję zainstalować fonts-dejavu...")
    import subprocess
    try:
        subprocess.run(
            ["apt-get", "install", "-y", "--no-install-recommends", "fonts-dejavu-core"],
            check=True, capture_output=True, timeout=60,
        )
        # Spróbuj jeszcze raz po instalacji
        for candidate in _SYSTEM_FONT_CANDIDATES:
            p = Path(candidate)
            if p.exists():
                import shutil
                dest = FONT_BOLD_PATH if "Bold" in p.name else FONT_PATH
                shutil.copy(p, dest)
        if FONT_PATH.exists():
            logger.info("✅ Czcionki zainstalowane przez apt-get.")
            return
    except Exception as e:
        logger.error(f"❌ apt-get nie powiodło się: {e}")

    raise RuntimeError(
        "Nie można znaleźć czcionki DejaVuSans.ttf. "
        "Uruchom w kontenerze: apt-get install fonts-dejavu-core"
    )


def _register_fonts():
    """Rejestruje czcionki DejaVuSans w ReportLab."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_BOLD_PATH)))


def generate_cmr_pdf(doc: ParsedDocument) -> str:
    """
    Generuje list przewozowy CMR w formacie PDF na podstawie ParsedDocument.
    Zwraca ścieżkę do pliku (np. 'static/docs/cmr_xxx.pdf').
    Rzuca RuntimeError jeśli generowanie się nie powiedzie.
    """
    _ensure_dirs()
    _ensure_fonts()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER

        _register_fonts()

        filename = f"cmr_{uuid.uuid4().hex[:8]}.pdf"
        filepath = DOCS_DIR / filename

        doc_pdf = SimpleDocTemplate(
            str(filepath),
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        # ── Style z DejaVuSans (obsługuje polskie znaki) ──────────────
        title_style = ParagraphStyle(
            "CMRTitle",
            fontName="DejaVu-Bold",
            fontSize=15,
            textColor=colors.HexColor("#1a3a6b"),
            spaceAfter=4 * mm,
            alignment=TA_CENTER,
        )
        sub_style = ParagraphStyle(
            "CMRSub",
            fontName="DejaVu",
            fontSize=9,
            textColor=colors.HexColor("#555"),
            alignment=TA_CENTER,
            spaceAfter=6 * mm,
        )
        label_style = ParagraphStyle(
            "Label",
            fontName="DejaVu-Bold",
            fontSize=7,
            textColor=colors.HexColor("#4a5568"),
        )
        value_style = ParagraphStyle(
            "Value",
            fontName="DejaVu",
            fontSize=10,
            textColor=colors.black,
            spaceAfter=1 * mm,
        )
        footer_label_style = ParagraphStyle(
            "FooterLabel",
            fontName="DejaVu",
            fontSize=7,
            textColor=colors.grey,
        )
        note_style = ParagraphStyle(
            "Note",
            fontName="DejaVu",
            fontSize=7,
            textColor=colors.grey,
            alignment=TA_CENTER,
        )

        story = []
        now_str = datetime.utcnow().strftime("%d.%m.%Y %H:%M UTC")
        doc_nr = f"CMR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # ── Nagłówek ──────────────────────────────────────────────────
        story.append(Paragraph("MIĘDZYNARODOWY LIST PRZEWOZOWY — CMR", title_style))
        story.append(Paragraph(f"Dokument nr: <b>{doc_nr}</b>", sub_style))

        # ── Tabela danych ─────────────────────────────────────────────
        def row(label: str, value):
            v = str(value) if value else "—"
            return [Paragraph(label, label_style), Paragraph(v, value_style)]

        data = [
            [Paragraph("POLE / FIELD", label_style), Paragraph("WARTOŚĆ / VALUE", label_style)],
            row("1. Nadawca / Sender",            doc.sender_name or "SmartLoad AI"),
            row("2. Adres nadawcy / Sender addr", doc.sender_address or "—"),
            row("3. Odbiorca / Receiver",          doc.receiver_name or "—"),
            row("4. Adres odbiorcy / Receiver addr", doc.receiver_address or "—"),
            row("5. Miejsce załadunku / Loading",  doc.origin or "—"),
            row("6. Miejsce rozładunku / Unloading", doc.destination or "—"),
            row("7. Opis towaru / Cargo",           doc.cargo_description or "Cargo"),
            row("8. Masa towaru / Weight",          f"{doc.weight_kg:,.0f} kg" if doc.weight_kg else "—"),
            row("9. Nr rejestracyjny / Plate",      doc.vehicle_plate or "—"),
            row("10. Stawka frachtowa / Price",     f"{doc.price} {doc.currency}" if doc.price else "—"),
            row("11. Data załadunku / Load date",   str(doc.load_date) if doc.load_date else now_str),
            row("12. Data wystawienia / Issued",    now_str),
            row("13. Status",                       "WYGENEROWANY AUTOMATYCZNIE — SmartLoad AI"),
        ]

        col_widths = [60 * mm, 110 * mm]
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            # Nagłówek tabeli
            ("BACKGROUND",   (0, 0), (-1, 0), colors.HexColor("#1a3a6b")),
            ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
            ("FONTNAME",     (0, 0), (-1, 0), "DejaVu-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 8),
            ("ALIGN",        (0, 0), (-1, 0), "CENTER"),
            # Komórki
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef2f8")]),
            ("GRID",         (0, 0), (-1, -1), 0.5,  colors.HexColor("#c5d0e0")),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING",  (0, 0), (-1, -1), 4 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ("TOPPADDING",   (0, 0), (-1, -1), 2.5 * mm),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 2.5 * mm),
        ]))

        story.append(table)
        story.append(Spacer(1, 10 * mm))

        # ── Stopka z miejscami na podpisy ────────────────────────────
        footer_data = [
            [
                Paragraph("Podpis i pieczęć nadawcy", footer_label_style),
                Paragraph("Podpis i pieczęć przewoźnika", footer_label_style),
                Paragraph("Podpis i pieczęć odbiorcy", footer_label_style),
            ],
            ["", "", ""],
        ]
        footer_table = Table(footer_data, colWidths=[57 * mm, 57 * mm, 57 * mm])
        footer_table.setStyle(TableStyle([
            ("BOX",        (0, 0), (-1, -1), 0.5, colors.HexColor("#c5d0e0")),
            ("INNERGRID",  (0, 0), (-1, -1), 0.5, colors.HexColor("#c5d0e0")),
            ("ROWHEIGHTS", (0, 1), (-1, 1),  20 * mm),
            ("TOPPADDING", (0, 0), (-1, 0),  2 * mm),
            ("LEFTPADDING",(0, 0), (-1, -1), 3 * mm),
            ("FONTNAME",   (0, 0), (-1, -1), "DejaVu"),
        ]))
        story.append(footer_table)
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph(
            "Dokument wygenerowany automatycznie przez system SmartLoad AI. "
            "Niniejszy dokument stanowi potwierdzenie zlecenia transportowego.",
            note_style,
        ))

        doc_pdf.build(story)
        logger.info(f"✅ CMR PDF wygenerowany: {filepath}")
        return str(filepath)

    except ImportError:
        raise RuntimeError("Brak biblioteki reportlab. Uruchom: pip install reportlab")
    except Exception as e:
        logger.error(f"❌ Błąd generowania CMR PDF: {e}")
        raise RuntimeError(f"Nie udało się wygenerować dokumentu CMR: {e}")
