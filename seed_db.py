from sqlmodel import Session
from app.core.database import engine  # poprawiona ścieżka
from app.models.email_log import EmailLog
from datetime import datetime

# Pobranie wartosci testowych: docker exec -it smartload_backend python seed_db.py

def seed_test_emails():
    test_loads = [
        EmailLog(
            uid="TEST-001",
            sender="klient@logistyka-de.com",
            subject="Ładunek: Berlin -> Poznań (Plandeka)",
            body="Szukamy auta na jutro z Berlina do Poznania. Waga 24t, płacimy 800 EUR.",
            ai_category="OFERTA",
            loading_city="Berlin",
            loading_zip="10115",
            unloading_city="Poznań",
            unloading_zip="60-101",
            weight_kg=24000,
            price=800.0,
            currency="EUR",
            received_at=datetime.utcnow(),
            is_archived=False,
        ),
        EmailLog(
            uid="TEST-002",
            sender="oferty@trans-krak.pl",
            subject="Zlecenie Kraków - Monachium",
            body="Zlecę transport 12 ton. Kraków do Monachium. Stawka 1100 EUR. Gotowe do załadunku.",
            ai_category="OFERTA",
            loading_city="Kraków",
            loading_zip="30-001",
            unloading_city="Monachium",
            unloading_zip="80331",
            weight_kg=12000,
            price=1100.0,
            currency="EUR",
            received_at=datetime.utcnow(),
            is_archived=False,
        ),
        EmailLog(
            uid="TEST-003",
            sender="system@freight-paris.fr",
            subject="Express Paris to Madrid",
            body="Urgent load. Paris -> Madrid. 24000 kg. Price: 2500 EUR. Needs to be collected today.",
            ai_category="ZAMOWIENIE",
            loading_city="Paryż",
            loading_zip="75001",
            unloading_city="Madryt",
            unloading_zip="28001",
            weight_kg=24000,
            price=2500.0,
            currency="EUR",
            received_at=datetime.utcnow(),
            is_archived=False,
        ),
        EmailLog(
            uid="TEST-004",
            sender="spedycja@waw-trans.pl",
            subject="OFERTA Warszawa -> Berlin",
            body="Mamy ładunek z Warszawy (02-222) do Berlina. Waga: 24 tony. Dajemy 900 EUR.",
            ai_category="OFERTA",
            loading_city="Warszawa",
            loading_zip="02-222",
            unloading_city="Berlin",
            unloading_zip="10115",
            weight_kg=24000,
            price=900.0,
            currency="EUR",
            received_at=datetime.utcnow(),
            is_archived=False,
        ),
        EmailLog(
            uid="TEST-005",
            sender="info@italy-loads.it",
            subject="Małe auto Rzym - Mediolan",
            body="Szukam busa na 3.5t z Rzymu do Mediolanu. Płacę 600 EUR od ręki.",
            ai_category="OFERTA",
            loading_city="Rzym",
            loading_zip="00100",
            unloading_city="Mediolan",
            unloading_zip="20100",
            weight_kg=3500,
            price=600.0,
            currency="EUR",
            received_at=datetime.utcnow(),
            is_archived=False,
        ),
    ]

    with Session(engine) as session:
        added = 0
        for load in test_loads:
            # Sprawdzamy czy UID już istnieje, żeby nie duplikować
            from sqlmodel import select
            existing = session.exec(select(EmailLog).where(EmailLog.uid == load.uid)).first()
            if not existing:
                session.add(load)
                added += 1
            else:
                print(f"  ⏭️  Pominięto (już istnieje): {load.uid}")
        session.commit()
        print(f"✅ Pomyślnie dodano {added} testowych ładunków do bazy danych!")


if __name__ == "__main__":
    seed_test_emails()
