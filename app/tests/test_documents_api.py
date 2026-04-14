import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app
from app.services.llm_service import ShipmentData

client = TestClient(app)

MOCK_SHIPMENT = ShipmentData(
    sender="Firma ABC",
    recipient="Firma XYZ",
    origin="Warszawa",
    destination="Kraków",
    pickup_date="2026-04-15",
    delivery_date="2026-04-16",
    weight_kg=500.0,
    price=1200.0,
    currency="PLN",
)


def test_parse_rejects_non_pdf():
    response = client.post(
        "/documents/parse",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


@patch("app.api.documents.extract_shipment_data", new_callable=AsyncMock)
@patch("app.api.documents.extract_text_from_pdf", return_value="tekst z PDF")
def test_extract_returns_shipment(mock_ocr, mock_llm):
    mock_llm.return_value = MOCK_SHIPMENT

    with open("app/tests/fixtures/faktura_transportowa_002.pdf", "rb") as f:
        response = client.post(
            "/documents/extract",
            files={"file": ("faktura.pdf", f, "application/pdf")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["sender"] == "Firma ABC"
    assert data["currency"] == "PLN"
    assert data["pickup_date"] == "2026-04-15"