# app/services/ocr_service.py

import re
import fitz
import pytesseract
from pdf2image import convert_from_bytes

TESSERACT_LANG = "pol+eng"
MIN_TEXT_LENGTH = 50


def normalize_text(text: str) -> str:
    # Wielokrotne spacje → jedna
    text = re.sub(r' {2,}', ' ', text)
    # Więcej niż 2 newliny → dwa
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Usuń znaki kontrolne (oprócz \n)
    text = re.sub(r'[^\S\n]+', ' ', text)
    # Trim każdej linii
    text = '\n'.join(line.strip() for line in text.splitlines())
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
    return normalize_text(raw)  # ← normalizacja tutaj


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