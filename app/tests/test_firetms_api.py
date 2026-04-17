"""
Testy dla Task 2.2 – nowe endpointy fireTMS mock + exchange service.
Uruchom: pytest tests/test_firetms_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime

from main import app
from app.models.load import Load

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_load():
    return Load(
        id=1,
        origin="Katowice, PL",
        destination="Berlin, DE",
        title="Palety z elektroniką",
        weight_kg=12000.0,
        category="elektronika",
        price=1800.0,
        offer_id="EXT-TEST-001",
        source="cargopedia",
        scraped_at=datetime(2026, 4, 13, 10, 0, 0),
    )


# ---------------------------------------------------------------------------
# Contractors
# ---------------------------------------------------------------------------

class TestContractors:
    def test_get_contractors_returns_list(self):
        resp = client.get("/api/contractors")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "totalItems" in data
        assert len(data["items"]) > 0

    def test_get_contractors_count(self):
        resp = client.get("/api/contractors/count")
        assert resp.status_code == 200
        assert "count" in resp.json()

    def test_create_contractor(self):
        payload = {
            "name": "Test Sp. z o.o.",
            "shortName": "Test",
            "taxId": "1111111111",
        }
        resp = client.post("/api/contractors", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Sp. z o.o."
        assert "id" in data

    def test_get_bank_accounts_existing(self):
        resp = client.get("/api/contractors/c1-0000-0000-0000-000000000001/bank-accounts")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data

    def test_get_bank_accounts_not_found(self):
        resp = client.get("/api/contractors/nonexistent-id/bank-accounts")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Offers
# ---------------------------------------------------------------------------

class TestOffers:
    def test_list_offers_returns_data(self):
        resp = client.get("/api/offers")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_offer(self):
        payload = {
            "offer": {
                "description": "Test Kraków → Wien",
                "expireDate": "2026-04-30T12:00:00",
                "externalId": "TEST-OFFER-001",
                "price": {"amount": 1500, "currencyCode": "EUR"},
                "loadingSpot": {"city": "Kraków", "country": "PL"},
                "unloadSpot": {"city": "Wien", "country": "AT"},
            },
            "exchangeDetails": {
                "publishOnFireXgo": True,
                "paymentDetails": {"paymentDays": 30, "paymentType": "DAYS_FROM_INVOICE"},
            },
        }
        resp = client.post("/api/offers", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["status"] == "CREATED"

    def test_get_offer_by_id(self):
        resp = client.get("/api/offers/of-0000-0000-0000-000000000001")
        assert resp.status_code == 200

    def test_get_offer_not_found(self):
        resp = client.get("/api/offers/nonexistent")
        assert resp.status_code == 404

    def test_update_offer(self):
        payload = {"offer": {"description": "Zaktualizowana trasa"}}
        resp = client.put("/api/offers/of-0000-0000-0000-000000000001", json=payload)
        assert resp.status_code == 200
        assert resp.json()["status"] == "UPDATED"

    def test_delete_offer(self):
        # Najpierw utwórz
        create_resp = client.post("/api/offers", json={
            "offer": {"description": "Do usunięcia", "externalId": "DELETE-ME"}
        })
        offer_id = create_resp.json()["id"]
        # Teraz usuń
        del_resp = client.delete(f"/api/offers/{offer_id}")
        assert del_resp.status_code == 204
        # Sprawdź że zniknęła
        get_resp = client.get(f"/api/offers/{offer_id}")
        assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class TestOrders:
    def test_get_orders_returns_list(self):
        resp = client.get("/api/orders")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) > 0

    def test_get_orders_filter_by_status(self):
        resp = client.get("/api/orders?status=IN_PROGRESS")
        assert resp.status_code == 200

    def test_get_order_by_id(self):
        resp = client.get("/api/orders/ord-0000-0000-0000-000000000001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["orderNumber"] == "ZL/2026/001"

    def test_create_transport_order(self):
        payload = {
            "loadIds": ["1", "2"],
            "truckId": "b9bc1394-6692-463b-85f7-f96bac02c461",
        }
        resp = client.post("/api/transport-order", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "CREATED"
        assert "orderNumber" in data


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

class TestDepartments:
    def test_get_departments(self):
        resp = client.get("/api/departments")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) >= 3

    def test_create_department(self):
        resp = client.post("/api/departments", json={"name": "Wrocław", "code": "WRO", "city": "Wrocław"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Wrocław"

    def test_get_department_by_id(self):
        resp = client.get("/api/departments/dep-0000-0001")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Katowice"

    def test_get_department_not_found(self):
        resp = client.get("/api/departments/nonexistent")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Currency & Payments
# ---------------------------------------------------------------------------

class TestCurrencyAndPayments:
    def test_get_currency_tables(self):
        resp = client.get("/api/currency-tables")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) > 0
        rates = data["items"][0]["rates"]
        codes = [r["currencyCode"] for r in rates]
        assert "EUR" in codes
        assert "USD" in codes

    def test_mark_payment(self):
        payload = {
            "paid": True,
            "amount": 4500.00,
            "currencyCode": "PLN",
            "paymentDate": "2026-04-13T10:00:00",
        }
        resp = client.put("/api/payment", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["paid"] is True
        assert data["amount"] == 4500.00


# ---------------------------------------------------------------------------
# Exchange service (Task 2.2)
# ---------------------------------------------------------------------------

class TestExchangeService:
    def test_exchange_stats_endpoint(self):
        resp = client.get("/api/exchange/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "totalLoads" in data
        assert "activeOffers" in data
        assert "loadsBySource" in data

    def test_load_to_offer_mapping(self, sample_load):
        from app.services.exchange_service import load_to_offer_dto
        dto = load_to_offer_dto(sample_load)
        assert dto.externalId == "EXT-TEST-001"
        assert dto.price.amount == 1800.0
        assert dto.price.currencyCode == "EUR"
        assert dto.loadingSpot.city == "Katowice"
        assert dto.unloadSpot.city == "Berlin"
        assert dto.description == "Palety z elektroniką"

    def test_extract_city_helper(self):
        from app.services.exchange_service import _extract_city
        assert _extract_city("Katowice, PL") == "Katowice"
        assert _extract_city("Berlin, DE") == "Berlin"
        assert _extract_city("Warszawa") == "Warszawa"
        assert _extract_city(None) is None

    def test_extract_country_helper(self):
        from app.services.exchange_service import _extract_country
        assert _extract_country("Katowice, PL") == "PL"
        assert _extract_country("Berlin, DE") == "DE"
        assert _extract_country("Warszawa") == "PL"  # default

    def test_guess_semitrailer_type(self):
        from app.services.exchange_service import _guess_semitrailer_type
        assert _guess_semitrailer_type("chłodnia") == ["REFRIGERATOR"]
        assert _guess_semitrailer_type("cysterna") == ["TANKER"]
        assert _guess_semitrailer_type("drewno") == ["FLATBED"]
        assert _guess_semitrailer_type("elektronika") == ["CURTAINSIDER"]
        assert _guess_semitrailer_type(None) == ["CURTAINSIDER"]
