import os
from sqlalchemy import text  # <-- DODAJ TO
from sqlmodel import Session, select, create_engine, SQLModel
from app.models.user import User
from app.models.load import Load  # Upewnij się, że Load też jest zaimportowany!
from app.core.security import get_password_hash

def create_superuser():
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)

    # --- KROK 1: WŁĄCZAMY WSPARCIE DLA WEKTORÓW ---
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
        print("✅ Rozszerzenie pgvector włączone.")

    # --- KROK 2: TWORZYMY TABELE ---
    # Teraz tabela 'load' z polem VECTOR przejdzie bez błędu
    SQLModel.metadata.create_all(engine)

    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")

    with Session(engine) as session:
        statement = select(User).where(User.username == admin_user)
        user = session.exec(statement).first()
        
        if not user:
            hashed_password = get_password_hash(admin_pass)
            new_admin = User(username=admin_user, hashed_password=hashed_password)
            session.add(new_admin)
            session.commit()
            print(f"✅ SUKCES: Admin dodany: {admin_user}")
        else:
            print(f"⚠️ INFO: Admin {admin_user} już istnieje.")

if __name__ == "__main__":
    create_superuser()