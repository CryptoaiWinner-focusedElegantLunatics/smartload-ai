"""
seed_firetms.py
Ładuje prawdziwe dane z fireTMS do in-memory stores naszego mock API.
Wywołaj raz przy starcie lub ręcznie: python seed_firetms.py

Mapuje różnice w strukturze JSON między fireTMS a naszymi modelami.
"""
import json
from pathlib import Path
from datetime import datetime

# --- Ścieżka do plików JSON (domyślnie obok tego skryptu) ---
DATA_DIR = Path(__file__).parent / "firetms_data"


# ---------------------------------------------------------------------------
# CONTRACTORS
# ---------------------------------------------------------------------------

def load_contractors():
    from app.api.contractors import _contractors, _bank_accounts
    from app.models.contractor import (
        ContractorResponse, AddressApiDto,
        PaymentTermApiDto, ContactPersonApiDto
    )

    path = DATA_DIR / "contractors.json"
    if not path.exists():
        print("[seed] Brak pliku contractors.json – pomijam")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    _contractors.clear()

    for item in data.get("items", []):
        addr_raw = item.get("address") or {}
        address = AddressApiDto(
            city=addr_raw.get("city"),
            country=addr_raw.get("countryCode"),
            postalCode=addr_raw.get("normalizedZipCode") or addr_raw.get("originalZipCode"),
            street=addr_raw.get("streetWithNumber"),
        )

        purchase_term_raw = item.get("purchasePaymentTerm") or {}
        purchase_term = PaymentTermApiDto(
            basePoint=purchase_term_raw.get("basePoint"),
            daysOffset=purchase_term_raw.get("daysOffset"),
            offsetType=purchase_term_raw.get("offsetType"),
        ) if purchase_term_raw else None

        sales_term_raw = item.get("salesPaymentTerm") or {}
        sales_term = PaymentTermApiDto(
            basePoint=sales_term_raw.get("basePoint"),
            daysOffset=sales_term_raw.get("daysOffset"),
            offsetType=sales_term_raw.get("offsetType"),
        ) if sales_term_raw else None

        contacts = [
            ContactPersonApiDto(
                firstName=cp.get("firstName"),
                lastName=cp.get("lastName"),
                phone=cp.get("phone") or cp.get("mobile"),
                email=cp.get("email"),
            )
            for cp in item.get("contactPersons") or []
        ]

        contractor = ContractorResponse(
            id=item["id"],
            name=item.get("name", ""),
            shortName=item.get("shortName") or item.get("name", "")[:20],
            taxId=item.get("normalizedTaxId"),
            vatEuId=item.get("normalizedVatEuId"),
            primaryAddress=address,
            paymentTermForCarrier=purchase_term,
            paymentTermForClient=sales_term,
            contactPersons=contacts,
        )
        _contractors[contractor.id] = contractor

    print(f"[seed] Załadowano {len(_contractors)} kontrahentów")


# ---------------------------------------------------------------------------
# DEPARTMENTS
# ---------------------------------------------------------------------------

def load_departments():
    from app.api.departments import _departments
    from app.models.department import DepartmentResponse

    path = DATA_DIR / "departments.json"
    if not path.exists():
        print("[seed] Brak pliku departments.json – pomijam")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    _departments.clear()

    for item in data.get("items", []):
        dept = DepartmentResponse(
            id=item["id"],
            name=item.get("name", ""),
            code=item.get("docNumberGroupingCode"),
            city=item.get("companyName"),  # fireTMS nie zwraca miasta wprost
        )
        _departments[dept.id] = dept

    print(f"[seed] Załadowano {len(_departments)} oddziałów")


# ---------------------------------------------------------------------------
# ORDERS
# ---------------------------------------------------------------------------

def load_orders():
    from app.api.orders import _orders
    from app.models.order import OrderResponse

    path = DATA_DIR / "orders.json"
    if not path.exists():
        print("[seed] Brak pliku orders.json – pomijam")
        return

    data = json.loads(path.read_text(encoding="utf-8"))
    _orders.clear()

    for item in data.get("items", []):
        order = OrderResponse(
            id=item["id"],
            orderNumber=item.get("orderNumber"),
            status=item.get("status"),
            atsStatus=item.get("atsStatus"),
            carrierName=item.get("carrierName"),
            client=item.get("client"),
            clientOrderNumbers=item.get("clientOrderNumbers"),
            clientOrderSpeditors=item.get("clientOrderSpeditors"),
            clientPrices=item.get("clientPrices"),
            clientPricePerTotalKm=item.get("clientPricePerTotalKm"),
            clientPricePerLoadedKm=item.get("clientPricePerLoadedKm"),
            price=item.get("price"),
            expenses=item.get("expenses"),
            provision=item.get("provision"),
            createDate=item.get("createDate"),
            departmentName=item.get("departmentName"),
            speditor=item.get("speditor"),
            driverName=item.get("driverName"),
            secondDriverName=item.get("secondDriverName"),
            truckRegistrationNumber=item.get("truckRegistrationNumber"),
            semitrailerRegistrationNumber=item.get("semitrailerRegistrationNumber"),
            truckStatus=item.get("truckStatus"),
            contactPerson=item.get("contactPerson"),
            contactPhone=item.get("contactPhone"),
            loadingsDescription=item.get("loadingsDescription"),
            unloadingsDescription=item.get("unloadingsDescription"),
            totalLdm=item.get("totalLdm"),
            totalWeightInKg=item.get("totalWeightInKg"),
            cargoNames=item.get("cargoNames"),
            notes=item.get("notes"),
            emptyKm=item.get("emptyKm"),
            loadedKm=item.get("loadedKm"),
            totalKm=item.get("totalKm"),
            tags=item.get("tags"),
            subStatuses=item.get("subStatuses"),
            mileageOutsideCorridor=item.get("mileageOutsideCorridor"),
            realEmptyMileage=item.get("realEmptyMileage"),
            realLoadedMileage=item.get("realLoadedMileage"),
            realMileage=item.get("realMileage"),
            lastAtsStatusChangeCause=item.get("lastAtsStatusChangeCause"),
        )
        _orders[order.id] = order

    print(f"[seed] Załadowano {len(_orders)} zleceń")


# ---------------------------------------------------------------------------
# LOADS (→ baza PostgreSQL przez SQLModel)
# ---------------------------------------------------------------------------

def load_loads():
    """
    Ładuje loads z fireTMS JSON do bazy PostgreSQL.
    Mapuje pola fireTMS → nasz model Load.
    """
    path = DATA_DIR / "loads.json"
    if not path.exists():
        print("[seed] Brak pliku loads.json – pomijam")
        return

    try:
        from sqlmodel import Session
        from app.core.database import engine
        from app.models.load import Load

        data = json.loads(path.read_text(encoding="utf-8"))

        with Session(engine) as session:
            saved = 0
            skipped = 0
            for item in data.get("items", []):
                offer_id = item.get("id")

                # Sprawdź duplikat
                existing = session.query(Load).filter_by(offer_id=offer_id, source="firetms").first()
                if existing:
                    skipped += 1
                    continue

                # Parsuj wagę z "200,0 kg" → 200.0
                weight_raw = item.get("totalWeight", "") or ""
                weight_kg = None
                try:
                    weight_kg = float(weight_raw.replace(" kg", "").replace(",", ".").strip())
                except (ValueError, AttributeError):
                    pass

                # Parsuj cenę z "600,00 PLN" → 600.0
                price_raw = item.get("payerSum", "") or ""
                price = None
                try:
                    price = float(price_raw.split()[0].replace(",", "."))
                except (ValueError, IndexError, AttributeError):
                    pass

                load = Load(
                    origin=item.get("loadingsDescr", ""),
                    destination=item.get("unloadingsDescr", ""),
                    title=item.get("cargoNamesWithDescriptions"),
                    weight_kg=weight_kg,
                    price=price,
                    price_raw=price_raw,
                    offer_id=offer_id,
                    url=None,
                    source="firetms",
                    scraped_at=_parse_date(item.get("orderCreateDate")),
                    category=_guess_category(item.get("cargoNamesWithDescriptions", "")),
                )
                session.add(load)
                saved += 1

            session.commit()
            print(f"[seed] Loads → zapisano: {saved}, pominięto duplikatów: {skipped}")

    except Exception as e:
        print(f"[seed] Błąd ładowania loads do DB: {e}")


# ---------------------------------------------------------------------------
# CURRENCY TABLES
# ---------------------------------------------------------------------------

def load_currency_tables():
    from app.api.departments import _departments  # tylko żeby zaimportować moduł
    from app.models.department import CurrencyTableResponse, CurrencyRate

    path = DATA_DIR / "currency-tables.json"
    if not path.exists():
        print("[seed] Brak pliku currency-tables.json – pomijam")
        return

    # Nadpisujemy getter w departments.py przez patch store
    import app.api.departments as dept_module

    data = json.loads(path.read_text(encoding="utf-8"))
    tables = []

    for item in data.get("items", []):
        rates = [
            CurrencyRate(
                currencyCode=r["currency"],
                rate=r["rate"],
                baseCode="PLN" if item.get("authority") == "NBP" else item.get("authority", "PLN"),
            )
            for r in item.get("currencyRates", [])
        ]
        table = CurrencyTableResponse(
            id=item["id"],
            name=f"{item.get('authority', '')} {item.get('tableNumber', '')}",
            date=item.get("tableDate"),
            rates=rates,
        )
        tables.append(table)

    # Patch: podmieniamy dane w module departments
    dept_module._currency_tables_data = tables
    print(f"[seed] Załadowano {len(tables)} tabel kursów walut")


# ---------------------------------------------------------------------------
# SŁOWNIKI (purchase-service-type, purchase-tax-rates, unit-of-measure)
# ---------------------------------------------------------------------------

def load_dictionaries():
    """Ładuje słowniki do prostych in-memory list."""
    import app.api.departments as dept_module

    for filename, attr_name in [
        ("purchase-service-type.json", "_purchase_service_types"),
        ("purchase-tax-rates.json", "_purchase_tax_rates"),
        ("unit-of-measure.json", "_units_of_measure"),
    ]:
        path = DATA_DIR / filename
        if not path.exists():
            print(f"[seed] Brak pliku {filename} – pomijam")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        setattr(dept_module, attr_name, data.get("items", []))
        print(f"[seed] Załadowano {len(data.get('items', []))} rekordów z {filename}")


# ---------------------------------------------------------------------------
# HELPERY
# ---------------------------------------------------------------------------

def _parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        # fireTMS format: "2026-04-13T00:00:00.000+02:00"
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _guess_category(cargo_names: str) -> str | None:
    if not cargo_names:
        return None
    lower = cargo_names.lower()
    if any(w in lower for w in ["chłod", "mroz", "frozen", "cold"]):
        return "chłodnia"
    if any(w in lower for w in ["palet", "euro"]):
        return "palety"
    if any(w in lower for w in ["cystern", "plyn"]):
        return "cysterna"
    return "neutralny"


# ---------------------------------------------------------------------------
# GŁÓWNA FUNKCJA
# ---------------------------------------------------------------------------

def seed_all():
    print("[seed] Rozpoczynam ładowanie danych fireTMS...")
    load_contractors()
    load_departments()
    load_orders()
    load_loads()
    load_currency_tables()
    load_dictionaries()
    print("[seed] Gotowe!")


if __name__ == "__main__":
    seed_all()
