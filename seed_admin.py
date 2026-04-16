import os
from sqlmodel import Session, select, create_engine
from app.models.user import User
from app.core.security import get_password_hash

def create_superuser():
    # 1. Pobieramy URL bezpośrednio wewnątrz funkcji
    database_url = os.getenv("DATABASE_URL")
    
    # 2. Tworzymy nowy, świeży silnik (Engine) TYLKO dla tej operacji
    # To omija problem "zablokowanego" połączenia w app.database
    engine = create_engine(database_url)

    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")

    with Session(engine) as session:
        # Sprawdzamy, czy użytkownik już istnieje
        statement = select(User).where(User.username == admin_user)
        user = session.exec(statement).first()
        
        if not user:
            hashed_password = get_password_hash(admin_pass)
            new_admin = User(username=admin_user, hashed_password=hashed_password)
            session.add(new_admin)
            session.commit()
            print(f"✅ SUKCES: Utworzono admina: {admin_user}")
        else:
            print(f"⚠️ INFO: Admin {admin_user} już istnieje.")