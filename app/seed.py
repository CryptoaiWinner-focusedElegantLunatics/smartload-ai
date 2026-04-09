from sqlmodel import Session
from app.core.database import engine
from app.models.load import Load

# Testowe dane z rynku spedycyjnego
mock_loads = [
    Load(origin="Warszawa, PL", destination="Berlin, DE", price=850.00),
    Load(origin="Paryż, FR", destination="Madryt, ES", price=1200.00),
    Load(origin="Mediolan, IT", destination="Monachium, DE", price=650.00)
]

def seed_db():
    with Session(engine) as session:
        # Sprawdzamy czy baza jest pusta
        existing = session.query(Load).first()
        if existing:
            print("Baza ma już dane, pomijam seedowanie.")
            return

        print("Wrzucam testowe ładunki do bazy...")
        for load in mock_loads:
            session.add(load)
        
        session.commit()
        print("Gotowe! Możecie testować.")

if __name__ == "__main__":
    seed_db()