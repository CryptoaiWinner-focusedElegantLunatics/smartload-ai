# app/services/ocr_service.py
import fitz  # PyMuPDF
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io

TESSERACT_LANG = "pol+eng"
MIN_TEXT_LENGTH = 50  # próg — mniej znaków = strona prawdopodobnie skanowana


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Główna funkcja: przyjmuje surowe bajty PDF,
    zwraca pełny tekst jako string.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []

    for page_num, page in enumerate(doc):
        native_text = page.get_text("text").strip()

        if len(native_text) >= MIN_TEXT_LENGTH:
            # PDF z warstwą tekstową — szybka ścieżka
            pages_text.append(native_text)
        else:
            # Strona skanowana — konwertuj do obrazu i odpal OCR
            ocr_text = _ocr_page(pdf_bytes, page_num)
            pages_text.append(ocr_text)

    doc.close()
    return "\n\n".join(pages_text)


def _ocr_page(pdf_bytes: bytes, page_num: int) -> str:
    """Konwertuje jedną stronę PDF → obraz → OCR."""
    images = convert_from_bytes(
        pdf_bytes,
        dpi=300,
        first_page=page_num + 1,
        last_page=page_num + 1,
    )
    if not images:
        return ""
    
    text = pytesseract.image_to_string(images[0], lang=TESSERACT_LANG)
    return text.strip()