"""
Generator CMR — ReportLab, 4 strony, polskie znaki (DejaVu Sans), layout 1:1 z cmr_template.html.
"""
import logging, asyncio, uuid, os
from pathlib import Path
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from app.models.document_schema import ParsedDocument

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_DIR = PROJECT_ROOT / "static" / "docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# ── Rejestracja czcionki DejaVu Sans (obsługa polskich znaków) ──
_FONT_REGISTERED = False
def _ensure_fonts():
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arial.ttf",  # fallback Windows
    ]
    regular = next((p for p in font_paths if os.path.exists(p)), None)
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if regular and "DejaVu" in regular:
        pdfmetrics.registerFont(TTFont("DS", regular))
        if os.path.exists(bold_path):
            pdfmetrics.registerFont(TTFont("DSB", bold_path))
        else:
            pdfmetrics.registerFont(TTFont("DSB", regular))
    elif regular:
        pdfmetrics.registerFont(TTFont("DS", regular))
        pdfmetrics.registerFont(TTFont("DSB", regular))
    else:
        # Fallback — Helvetica (bez polskich znaków)
        global _F, _FB
        return
    _FONT_REGISTERED = True

_F = "DS"    # regular
_FB = "DSB"  # bold

W, H = A4
ML = 22 * mm
MR = 18 * mm
MT = 10 * mm
FW = W - ML - MR  # form width
HALF = FW / 2
THIRD = FW / 3

# ── Definicja 4 stron CMR ──
PAGES = [
    {"color": "#e30613", "num": "1", "text": "Egzemplarz dla nadawcy\nExemplar für den Absender\nCopy for sender", "is_copy": False},
    {"color": "#005bb5", "num": "2", "text": "Egzemplarz dla odbiorcy\nExemplar für den Empfänger\nCopy for consignee", "is_copy": False},
    {"color": "#008a00", "num": "3", "text": "Egzemplarz dla przewoźnika\nExemplar für den Frachtführer\nCopy for carrier", "is_copy": False},
    {"color": "#000000", "num": "", "text": "KOPIA", "is_copy": True},
]


def _text(c, x, y, lines, font=None, size=5, color=None, leading=1.9):
    """Draw multiline text."""
    if font: c.setFont(font, size)
    if color: c.setFillColor(color)
    for i, line in enumerate(lines if isinstance(lines, list) else lines.split("\n")):
        c.drawString(x, y - i * size * leading / size * mm if i > 0 else y, line)
        y -= size * leading / size * mm if i > 0 else 0
    # Fix: just use fixed leading
    pass

def _multiline(c, x, y, text_str, font, size, color, lead_mm=2.0):
    c.setFont(font, size)
    c.setFillColor(color)
    for line in text_str.split("\n"):
        c.drawString(x, y, line)
        y -= lead_mm * mm


def _box(c, x, y, w, h, accent, lw=0.5):
    c.setStrokeColor(accent)
    c.setLineWidth(lw)
    c.rect(x, y - h, w, h)


def _vline(c, x, y1, y2, accent, lw=0.5):
    c.setStrokeColor(accent)
    c.setLineWidth(lw)
    c.line(x, y1, x, y2)


def _hline(c, x1, x2, y, accent, lw=0.5):
    c.setStrokeColor(accent)
    c.setLineWidth(lw)
    c.line(x1, y, x2, y)


def _label(c, x, y, num, lines, accent, num_size=12):
    """Box number + trilingual title lines."""
    c.setFont(_FB, num_size)
    c.setFillColor(accent)
    c.drawString(x + 1.5*mm, y - 4.5*mm, str(num))
    c.setFont(_F, 5)
    c.setFillColor(accent)
    ty = y - 4*mm
    for line in lines:
        c.drawString(x + 11*mm, ty, line)
        ty -= 1.8*mm


def _udata(c, x, y, text_str, offset_y=14, size=8.5):
    """User data in black."""
    c.setFont(_FB, size)
    c.setFillColor(black)
    for i, line in enumerate(str(text_str).split("\n")):
        c.drawString(x + 11*mm, y - offset_y*mm - i*3.2*mm, line)


def _draw_page(c, pg, doc_nr, now_str, load_date, doc, weight_str, price_str):
    accent = HexColor(pg["color"])

    c.setPageSize(A4)
    Y = H - MT

    # ═══ LEFT MARGIN — rotated text (bottom→top: Do wypełnienia, 1-15, włącznie, 19+20+22, Rubryki) ═══
    margin_x = ML - 5*mm

    # 1) "Do wypełnienia..." — bottommost
    c.saveState()
    c.translate(margin_x, 52*mm)
    c.rotate(90)
    c.setFont(_F, 4.8)
    c.setFillColor(accent)
    c.drawString(0, 2*mm, "Do wypełnienia pod odpowiedzialnością nadawcy")
    c.drawString(0, 0, "Auszufüllen unter der Verantwortung des Absenders")
    c.drawString(0, -2*mm, "To be completed on the sender's responsibility")
    c.restoreState()

    # 2) "1 - 15"
    c.saveState()
    c.translate(margin_x, 105*mm)
    c.rotate(90)
    c.setFont(_FB, 14)
    c.setFillColor(accent)
    c.drawString(0, 0, "1 - 15")
    c.restoreState()

    # 3) "włącznie oraz..."
    c.saveState()
    c.translate(margin_x, 125*mm)
    c.rotate(90)
    c.setFont(_F, 4.8)
    c.setFillColor(accent)
    c.drawString(0, 2*mm, "włącznie oraz")
    c.drawString(0, 0, "einschließlich")
    c.drawString(0, -2*mm, "including and")
    c.restoreState()

    # 4) "19 + 20 + 22"
    c.saveState()
    c.translate(margin_x, 155*mm)
    c.rotate(90)
    c.setFont(_FB, 14)
    c.setFillColor(accent)
    c.drawString(0, 0, "19 + 20 + 22")
    c.restoreState()

    # 5) "Rubryki obwiedzione..." — topmost
    c.saveState()
    c.translate(margin_x, 195*mm)
    c.rotate(90)
    c.setFont(_F, 4.2)
    c.setFillColor(accent)
    c.drawString(0, 2*mm, "Rubryki obwiedzione tłustymi liniami wypełnia przewoźnik.")
    c.drawString(0, 0, "Die mit fett gedruckten Linien eingerahmten Rubriken müssen vom Frachtführer ausgefüllt werden.")
    c.drawString(0, -2*mm, "The spaces framed with heavy lines must be filled by the carrier.")
    c.restoreState()

    # ═══ RIGHT MARGIN — vertical text (ADR info) ═══
    c.saveState()
    c.translate(W - MR + 8*mm, H/2 + 60*mm)
    c.rotate(-90)
    c.setFont(_F, 4)
    c.setFillColor(accent)
    c.drawString(0, 0, "* W przypadku przewozu towarów niebezpiecznych oprócz ewentualnego posiadania zaświadczenia,")
    c.drawString(0, -1.5*mm, "  należy podać w ostatnim wierszu: klasę, liczbę oraz, w danym przypadku, literę.")
    c.drawString(0, -3*mm, "* Bei gefährlichen Gütern ist die Klasse, die Ziffer, sowie ggf. der Buchstabe anzugeben.")
    c.drawString(0, -4.5*mm, "* In case of dangerous goods mention the class, the number and the letter, if any.")
    c.restoreState()

    # ═══ HEADER ═══
    if pg["is_copy"]:
        c.setFont(_FB, 40)
        c.setFillColor(accent)
        c.drawString(ML, Y - 8*mm, "KOPIA")
    else:
        c.setFont(_FB, 26)
        c.setFillColor(accent)
        c.drawString(ML, Y - 8*mm, pg["num"])
        c.setFont(_FB, 7)
        ty = Y - 3*mm
        for line in pg["text"].split("\n"):
            c.drawString(ML + 12*mm, ty, line)
            ty -= 2.5*mm

    Y -= 14*mm

    # ═══ OUTER BORDER ═══
    form_top = Y
    form_h = 244*mm
    _box(c, ML, form_top, FW, form_h, accent, lw=1.8)

    # ══════════ ROW 1: (1) Nadawca | CMR Info ══════════
    rh = 26*mm
    _hline(c, ML, ML+FW, Y-rh, accent)
    _vline(c, ML+HALF, Y, Y-rh, accent)

    _label(c, ML, Y, "1", [
        "Nadawca (nazwisko lub nazwa, adres, kraj)",
        "Absender (Name, Anschrift, Land)",
        "Sender (name, address, country)"
    ], accent)
    _udata(c, ML, Y, f"{doc.sender_name or ''}\n{doc.sender_address or ''}")

    # Prawa: CMR info
    rx = ML + HALF
    c.setFont(_F, 5)
    c.setFillColor(accent)
    _multiline(c, rx+4*mm, Y-3.5*mm,
        "MIĘDZYNARODOWY SAMOCHODOWY LIST PRZEWOZOWY\nINTERNATIONALER FRACHTBRIEF\nINTERNATIONAL CONSIGNMENT NOTE",
        _F, 5, accent, 1.8)
    c.setFont(_FB, 13)
    c.setFillColor(accent)
    c.drawString(rx+4*mm, Y-13*mm, "CMR No:")
    c.setFillColor(black)
    c.drawString(rx+30*mm, Y-13*mm, doc_nr)
    _multiline(c, rx+4*mm, Y-18*mm,
        "Niniejszy przewóz podlega postanowieniom konwencji o umowie międzynarodowej\nprzewozu drogowego towarów (CMR) bez względu na jakąkolwiek przeciwną klauzulę.",
        _F, 4.2, accent, 1.6)

    Y -= rh

    # ══════════ ROW 2: (2) Odbiorca | (16) Przewoźnik ══════════
    rh = 22*mm
    _hline(c, ML, ML+FW, Y-rh, accent)
    _vline(c, ML+HALF, Y, Y-rh, accent)

    _label(c, ML, Y, "2", [
        "Odbiorca (nazwisko lub nazwa, adres, kraj)",
        "Empfänger (Name, Anschrift, Land)",
        "Consignee (name, address, country)"
    ], accent)
    _udata(c, ML, Y, f"{doc.receiver_name or ''}\n{doc.receiver_address or ''}")

    _label(c, ML+HALF, Y, "16", [
        "Przewoźnik (nazwisko lub nazwa, adres, kraj)",
        "Frachtführer (Name, Anschrift, Land)",
        "Carrier (name, address, country)"
    ], accent)
    _udata(c, ML+HALF, Y, "SmartLoad AI\nPolska")
    c.setFont(_FB, 5.5); c.setFillColor(accent)
    c.drawString(ML+HALF+11*mm, Y-20*mm, "NR REJ.:")
    c.setFont(_FB, 8.5); c.setFillColor(black)
    c.drawString(ML+HALF+28*mm, Y-20*mm, doc.vehicle_plate or "")

    Y -= rh

    # ══════════ ROW 3: (3) Miejsce przeznaczenia | (17) Kolejni przewoźnicy ══════════
    rh = 18*mm
    _hline(c, ML, ML+FW, Y-rh, accent)
    _vline(c, ML+HALF, Y, Y-rh, accent)

    _label(c, ML, Y, "3", [
        "Miejsce przeznaczenia (miejscowość, kraj)",
        "Auslieferungsort des Gutes (Ort, Land)",
        "Place of delivery of the goods (place, country)"
    ], accent)
    _udata(c, ML, Y, doc.destination or "")

    _label(c, ML+HALF, Y, "17", [
        "Kolejni przewoźnicy (nazwisko lub nazwa, adres, kraj)",
        "Nachfolgende Frachtführer (Name, Anschrift, Land)",
        "Successive carriers (name, address, country)"
    ], accent)

    Y -= rh

    # ══════════ ROW 4: (4)+(5) | (18) ══════════
    rh4 = 16*mm; rh5 = 14*mm; rh_full = rh4 + rh5
    _hline(c, ML, ML+HALF, Y-rh4, accent)
    _hline(c, ML, ML+FW, Y-rh_full, accent)
    _vline(c, ML+HALF, Y, Y-rh_full, accent)

    _label(c, ML, Y, "4", [
        "Miejsce i data załadowania (miejscowość, kraj, data)",
        "Ort und Tag der Übernahme des Gutes (Ort, Land, Datum)",
        "Place and date taking over the goods (place, country, date)"
    ], accent)
    c.setFont(_FB, 8.5); c.setFillColor(black)
    c.drawString(ML+11*mm, Y-14*mm, doc.origin or "")
    c.drawRightString(ML+HALF-4*mm, Y-14*mm, load_date)

    _label(c, ML, Y-rh4, "5", [
        "Załączone dokumenty",
        "Beigefügte Dokumente",
        "Documents attached"
    ], accent)

    _label(c, ML+HALF, Y, "18", [
        "Zastrzeżenia i uwagi przewoźnika",
        "Vorbehalte und Bemerkungen der Frachtführer",
        "Carrier's reservations and observations"
    ], accent)

    Y -= rh_full

    # ══════════ GOODS TABLE HEADER (6-12) ══════════
    th = 12*mm
    # No full hline between header and data in goods table (matches reference CMR)

    cols = [
        (0.18, "6",  ["Cechy i numery","Kennzeichen und Nummern","Marks and Nos"]),
        (0.14, "7",  ["Ilość sztuk","Anzahl der Packstücke","Number of packages"]),
        (0.14, "8",  ["Sposób opakowania","Art der Verpackung","Method of packing"]),
        (0.16, "9",  ["Rodzaj towaru","Bezeichnung des Gutes","Nature of the goods"]),
        (0.13, "10", ["Numer statystyczny","Statistiknummer","Statistical number"]),
        (0.13, "11", ["Waga brutto w kg","Bruttogewicht in kg","Gross weight in kg"]),
        (0.12, "12", ["Objętość w m³","Umfang m³","Volume in m³"]),
    ]
    cx = ML
    for frac, num, labels in cols:
        cw = FW * frac
        # Vertical lines: only draw between groups (at col 10, 11, 12 boundaries)
        if num in ("10", "11", "12"):
            _vline(c, cx, Y, Y-th, accent, 0.3)
        cx_label = cx
        c.setFont(_FB, 9); c.setFillColor(accent)
        c.drawString(cx_label+1*mm, Y-4.5*mm, num)
        c.setFont(_F, 4.5)
        ty = Y-4*mm
        lbl_offset = 7*mm if len(num) > 1 else 5*mm
        for lbl in labels:
            c.drawString(cx_label+lbl_offset, ty, lbl); ty -= 1.8*mm
        cx += cw

    Y -= th

    # ══════════ GOODS DATA ROW ══════════
    dr = 10*mm
    _hline(c, ML, ML+FW, Y-dr, accent)
    vals = ["", "1", "Luzem/Paleta", "Towar neutralny", "", weight_str, ""]
    cx = ML
    c.setFont(_F, 7.5); c.setFillColor(black)
    for i, (frac, *_rest) in enumerate(cols):
        cw = FW * frac
        # Vertical lines in data row: only between groups (cols 10, 11, 12)
        if cols[i][1] in ("10", "11", "12"):
            _vline(c, cx, Y, Y-dr, accent, 0.3)
        c.drawString(cx+2*mm, Y-4.5*mm, vals[i])
        cx += cw

    Y -= dr

    # ADR row
    adr_h = 8*mm
    _hline(c, ML, ML+FW, Y-adr_h, accent)
    _vline(c, ML+FW*0.62, Y, Y-adr_h, accent, 0.3)
    c.setFont(_F, 5); c.setFillColor(accent)
    cx = ML+8*mm
    for lbl in ["Klasa / Klasse / Class", "Liczba / Ziffer / Number", "Litera / Buchstabe / Letter", "(ADR*)"]:
        c.drawString(cx, Y-5*mm, lbl); cx += 28*mm

    Y -= adr_h

    # ══════════ ROW: (13)+(14) | (19)+(20) ══════════
    rh13 = 20*mm; rh14 = 30*mm
    rh19 = 14*mm
    rh_left = rh13 + rh14

    # Lewa: 13
    _hline(c, ML, ML+HALF, Y-rh13, accent)
    _label(c, ML, Y, "13", [
        "Instrukcje nadawcy",
        "Anweisungen des Absenders",
        "Sender's instructions"
    ], accent)

    # Lewa: 14
    _hline(c, ML, ML+FW, Y-rh_left, accent)
    _vline(c, ML+HALF, Y, Y-rh_left, accent)
    _label(c, ML, Y-rh13, "14", [
        "Postanowienia odnośnie przewoźnego",
        "Frachtzahlungsanweisungen",
        "Instruction as to payment for carriage"
    ], accent)
    _udata(c, ML, Y-rh13, price_str, offset_y=12)
    c.setFont(_F, 4.5); c.setFillColor(accent)
    c.drawString(ML+11*mm, Y-rh13-24*mm, "Przewoźne zapłacone / frei / Carriage paid")
    c.drawString(ML+11*mm, Y-rh13-26.5*mm, "Przewoźne nieopłacone / Unfrei / Carriage forward")

    # Prawa: 19
    _hline(c, ML+HALF, ML+FW, Y-rh19, accent)
    _label(c, ML+HALF, Y, "19", [
        "Postanowienia specjalne",
        "Besondere Vereinbarungen",
        "Special agreements"
    ], accent)

    # Prawa: 20 — tabela płatności
    pay_h = rh_left - rh19
    _label(c, ML+HALF, Y-rh19, "20", [
        "Do zapłacenia",
        "Zu zahlen vom",
        "To be paid by"
    ], accent)

    # Vertical divider positions for table 20 columns
    pay_col_positions = [
        ML+HALF+28*mm,   # after "Do zapłacenia" label
        ML+HALF+44*mm,   # after "Nadawca"
        ML+HALF+52*mm,   # spacer
        ML+HALF+60*mm,   # after "Waluta"
        ML+HALF+68*mm,   # spacer
        ML+HALF+76*mm,   # after "Odbiorca"
    ]
    # Draw vertical dividers for table 20
    pay_top = Y - rh19
    pay_bottom = Y - rh_left
    for vx in pay_col_positions:
        _vline(c, vx, pay_top, pay_bottom, accent, 0.3)

    # Nagłówki kolumn tabeli 20 — shifted down for more top margin
    ptx = ML+HALF+28*mm
    pty = Y-rh19-6*mm   # extra margin from top
    c.setFont(_F, 4.2); c.setFillColor(accent)
    header_positions = [
        (ML+HALF+29*mm, "Nadawca\nAbsender\nSender"),
        (ML+HALF+53*mm, "Waluta\nWährung\nCurrency"),
        (ML+HALF+69*mm, "Odbiorca\nEmpfänger\nConsignee"),
    ]
    for hx, h in header_positions:
        lines_h = h.split("\n")
        tty = pty
        for lh in lines_h:
            c.drawString(hx, tty, lh); tty -= 1.6*mm

    # Wiersze tabeli 20 — shifted down
    pay_rows = [
        "Przewoźne / Fracht / Carriage charges",
        "Bonifikaty / Ermässigungen / Deductions",
        "Saldo / Zuschläge / Balance",
        "Dopłaty / Nebengebühren / Suppl. charges",
        "Koszty dodatkowe / Sonstiges / Miscellaneous",
        "Ubezpieczenie / Insurance",
        "Razem / Gesamtsumme / Total to be paid",
    ]
    pty -= 5*mm
    for i, row_label in enumerate(pay_rows):
        c.setFont(_F, 3.0); c.setFillColor(accent)
        c.drawString(ML+HALF+2*mm, pty, row_label)
        _hline(c, ML+HALF, ML+FW, pty+1.5*mm, accent, 0.3)
        if i == 0 or i == 6:
            c.setFont(_FB, 5); c.setFillColor(black)
            c.drawString(ML+HALF+30*mm, pty, str(getattr(doc, 'price', '') or ''))
            c.drawString(ML+HALF+54*mm, pty, str(getattr(doc, 'currency', 'PLN')))
        pty -= 3.5*mm

    Y -= rh_left

    # ══════════ ROW: (21)+data | (15) ══════════
    rh = 18*mm
    _hline(c, ML, ML+FW, Y-rh, accent)
    _vline(c, ML+HALF, Y, Y-rh, accent)

    _label(c, ML, Y, "21", [
        "Wystawiono w",
        "Ausgefertigt in",
        "Established in"
    ], accent)
    _udata(c, ML, Y, "Internet", offset_y=12, size=7)

    c.setFont(_F, 4.5); c.setFillColor(accent)
    c.drawString(ML+HALF-24*mm, Y-4*mm, "dnia"); c.drawString(ML+HALF-24*mm, Y-6*mm, "am"); c.drawString(ML+HALF-24*mm, Y-8*mm, "on")
    c.setFont(_FB, 7); c.setFillColor(black)
    c.drawString(ML+HALF-24*mm, Y-12*mm, now_str)

    _label(c, ML+HALF, Y, "15", [
        "Zapłata za pobraniem",
        "Nachnahme / Rückerstattung",
        "Cash on delivery"
    ], accent)

    Y -= rh

    # ══════════ SIGNATURES: (22)(23)(24) ══════════
    rh = 50*mm
    sigs = [
        ("22", ["Podpis i stempel nadawcy","Unterschrift und Stempel des Absenders","Signature and stamp of the sender"]),
        ("23", ["Podpis i stempel przewoźnika","Unterschrift und Stempel des Frachtführers","Signature and stamp of the carrier"]),
        ("24", []),
    ]
    for i, (num, lines) in enumerate(sigs):
        bx = ML + THIRD * i
        _vline(c, bx, Y, Y-rh, accent)
        c.setFont(_FB, 12); c.setFillColor(accent)
        c.drawString(bx+2*mm, Y-5*mm, num)
        c.setFont(_F, 4.5); c.setFillColor(accent)
        by = Y - rh + 4*mm
        for line in lines:
            c.drawString(bx+4*mm, by, line); by -= 1.8*mm

    # Box 24 extra: title (smaller font matching box-title size)
    bx24 = ML + THIRD * 2
    c.setFont(_F, 4.5); c.setFillColor(accent)
    c.drawString(bx24+12*mm, Y-5*mm, "Przesyłkę otrzymano / Gut empfangen")
    c.drawString(bx24+12*mm, Y-7*mm, "/ Goods received")
    # "Miejscowość / Ort / Place" written vertically (3 lines)
    c.setFont(_F, 4.5)
    c.drawString(bx24+4*mm, Y-11*mm, "Miejscowość")
    c.drawString(bx24+4*mm, Y-13*mm, "Ort")
    c.drawString(bx24+4*mm, Y-15*mm, "Place")
    # "dnia / am / on" written vertically (3 lines)
    c.drawString(bx24+THIRD-16*mm, Y-11*mm, "dnia")
    c.drawString(bx24+THIRD-16*mm, Y-13*mm, "am")
    c.drawString(bx24+THIRD-16*mm, Y-15*mm, "on")
    # Signature text at bottom of box 24
    c.setFont(_F, 4.5); c.setFillColor(accent)
    by24 = Y - rh + 4*mm
    for sig_line in ["Podpis i stempel odbiorcy","Unterschrift und Stempel des Empfängers","Signature and stamp of the consignee"]:
        c.drawString(bx24+4*mm, by24, sig_line); by24 -= 1.8*mm

    _hline(c, ML, ML+FW, Y-rh, accent, 1.8)

    Y -= rh

    # ══════════ FOOTER (no border — plain text below the form frame) ══════════
    c.setFont(_F, 4)
    c.setFillColor(accent)
    c.drawCentredString(W/2, Y-4*mm,
        "Wzór CMR/IRU/Polska z 1976 dla międzynarodowych przewozów drogowych odpowiada ustaleniom IRU.")


def _generate_cmr_pdf_sync(doc: ParsedDocument) -> str:
    _ensure_fonts()
    now = datetime.now(timezone.utc)
    now_str = now.strftime("%d/%m/%Y")
    doc_nr = f"CMR-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    load_date = doc.load_date.strftime("%d/%m/%Y") if getattr(doc, 'load_date', None) else now_str
    weight_str = f"{doc.weight_kg:,.0f}" if getattr(doc, 'weight_kg', None) else "0"
    price_str = f"{getattr(doc, 'price', '')} {getattr(doc, 'currency', 'PLN')}"

    filename = f"cmr_{uuid.uuid4().hex[:8]}.pdf"
    filepath = DOCS_DIR / filename

    try:
        c = canvas.Canvas(str(filepath), pagesize=A4)
        c.setTitle(f"CMR {doc_nr}")

        for pg in PAGES:
            _draw_page(c, pg, doc_nr, now_str, load_date, doc, weight_str, price_str)
            c.showPage()

        c.save()
        logger.info(f"✅ CMR 4-stronicowy wygenerowany: {filepath}")
        return str(filepath)
    except Exception as e:
        logger.error(f"❌ Błąd generowania CMR: {e}", exc_info=True)
        raise RuntimeError(f"Błąd ReportLab: {e}")


async def generate_cmr_pdf(doc: ParsedDocument) -> str:
    return await asyncio.to_thread(_generate_cmr_pdf_sync, doc)