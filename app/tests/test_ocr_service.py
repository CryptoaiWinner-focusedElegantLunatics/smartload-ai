from app.services.ocr_service import extract_text_from_pdf
import os

def test_native_pdf():
    with open("app/tests/fixtures/sample.pdf", "rb") as f:
        text = extract_text_from_pdf(f.read())
    assert len(text) > 10
    assert isinstance(text, str)