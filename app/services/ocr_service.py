import re
import unicodedata
import fitz
import pytesseract
from pdf2image import convert_from_bytes

TESSERACT_LANG = "pol+eng"
MIN_TEXT_LENGTH = 50

# Mapa błędnych kodowań polskich znaków (częste przy złym OCR)
_ENCODING_MAP = {
    "¹": "ą", "æ": "ć", "ê": "ę", "³": "ł", "ñ": "ń",
    "ó": "ó", "œ": "ś", "¿": "ż", "Ÿ": "ź",
    "¥": "Ą", "Æ": "Ć", "Ê": "Ę", "£": "Ł", "Ñ": "Ń",
    "Ó": "Ó", "Œ": "Ś", "¾": "Ż", "¬": "Ź",
}


def fix_polish_encoding(text: str) -> str:
    """Naprawia błędnie zakodowane polskie znaki."""
    for wrong, correct in _ENCODING_MAP.items():
        text = text.replace(wrong, correct)
    # Normalizacja Unicode NFC (łączy znaki z diakrytykami)
    return unicodedata.normalize("NFC", text)


def normalize_text(text: str) -> str:
    # Napraw polskie znaki przed dalszym czyszczeniem
    text = fix_polish_encoding(text)
    # Wielokrotne spacje → jedna
    text = re.sub(r" {2,}", " ", text)
    # Więcej niż 2 newliny → dwa
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Usuń znaki kontrolne (oprócz \n i \t)
    text = re.sub(r"[^\S\n\t]+", " ", text)
    # Trim każdej linii
    text = "\n".join(line.strip() for line in text.splitlines())
    # Usuń puste linie na początku/końcu
    return text.strip()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []

    for page_num, page in enumerate(doc):
        native_text = page.get_text("text").strip()

        if len(native_text) >= MIN_TEXT_LENGTH:
            pages_text.append(native_text)
        else:
            ocr_text = _ocr_page(pdf_bytes, page_num)
            pages_text.append(ocr_text)

    doc.close()
    raw = "\n\n".join(pages_text)
    return normalize_text(raw)


def _ocr_page(pdf_bytes: bytes, page_num: int) -> str:
    images = convert_from_bytes(
        pdf_bytes,
        dpi=300,
        first_page=page_num + 1,
        last_page=page_num + 1,
    )
    if not images:
        return ""
    return pytesseract.image_to_string(images[0], lang=TESSERACT_LANG).strip()