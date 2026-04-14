from app.services.ocr_service import extract_text_from_pdf
import fitz  # PyMuPDF — już masz w requirements


def _make_sample_pdf(text: str = "Testowy dokument spedycyjny") -> bytes:
    """Generuje minimalny PDF w pamięci — bez pliku na dysku."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 100), text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_native_pdf():
    pdf_bytes = _make_sample_pdf()
    text = extract_text_from_pdf(pdf_bytes)
    assert isinstance(text, str)
    assert len(text) > 10

def test_extracted_text_contains_content():
    pdf_bytes = _make_sample_pdf("Nadawca: Firma ABC, Odbiorca: Firma XYZ")
    text = extract_text_from_pdf(pdf_bytes)
    assert "Firma ABC" in text