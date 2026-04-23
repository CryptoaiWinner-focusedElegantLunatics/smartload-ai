import random
from datetime import datetime, timedelta
from sqlmodel import Session
from app.core.database import engine
from app.models.load import Load
from app.models.email_log import EmailLog

# Konfiguracja
CITIES_PL = ["Warszawa", "Poznań", "Wrocław", "Gdańsk", "Kraków", "Łódź", "Szczecin", "Lublin"]
CITIES_DE = ["Berlin", "Hamburg", "München", "Frankfurt", "Dortmund", "Stuttgart", "Leipzig", "Köln"]
HOT_ROUTES = [
    ("Warszawa", "Berlin"),
    ("Poznań", "Hamburg"),
    ("Wrocław", "München"),
    ("Gdańsk", "Berlin")
]

def generate_random_route():
    if random.random() < 0.4:  # 40% szans na trasę z puli "hot"
        return random.choice(HOT_ROUTES)
    return (random.choice(CITIES_PL), random.choice(CITIES_DE))

def seed_everything(count_emails=100, count_timo=50):
    with Session(engine) as session:
        print(f"🚀 Generowanie {count_emails} maili i {count_timo} ofert TimoCom...")
        
        # 1. Generowanie Maili (Twoja baza wewnętrzna)
        for i in range(count_emails):
            origin, dest = generate_random_route()
            weight = random.randint(1000, 24000)
            price = random.randint(300, 1500)
            
            email = EmailLog(
                uid=f"MAIL-SEED-{i:03d}",
                sender=f"spedycja_{random.randint(1,10)}@example.com",
                subject=f"Oferta ładunku: {origin} - {dest}",
                body=f"Cześć, mamy wolny ładunek {weight}kg na trasie {origin} do {dest}. Cena: {price} EUR.",
                loading_city=origin,
                unloading_city=dest,
                weight_kg=weight,
                price=float(price),
                currency="EUR",
                received_at=datetime.utcnow() - timedelta(days=random.randint(0, 5))
            )
            session.add(email)

        # 2. Generowanie Loadów (Symulacja TimoCom / Scraperów)
        for i in range(count_timo):
            origin, dest = generate_random_route()
            # Dla tras "hot" robimy ceny lekko niższe lub wyższe niż w mailach, żeby bot miał dylemat
            price = random.randint(350, 1400)
            weight_t = round(random.uniform(1.0, 24.0), 1)
            
            load = Load(
                origin=f"{origin}, PL",
                destination=f"{dest}, DE",
                weight_kg=weight_t * 1000,
                price=float(price),
                source="TIMOCOM",
                category="Firanka",
                scraped_at=datetime.utcnow(),
                offer_id=f"TIMO-{random.getrandbits(32)}"
            )
            session.add(load)

        session.commit()
        print("✅ Seeding zakończony sukcesem!")

if __name__ == "__main__":
    seed_everything()