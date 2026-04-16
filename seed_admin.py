import os
from sqlmodel import Session, select, create_engine, SQLModel
from app.models.user import User  # Upewnij się, że importujesz wszystkie modele!
from app.core.security import get_password_hash

def create_superuser():
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)

    # --- TA LINIA JEST KLUCZOWA ---
    # Tworzy wszystkie tabele (w tym tabelę "user"), których nie ma w bazie
    SQLModel.metadata.create_all(engine)
    # ------------------------------

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
            print(f"✅ SUKCES: Tabele utworzone i admin dodany: {admin_user}")
        else:
            print(f"⚠️ INFO: Tabele już są, a admin {admin_user} istnieje.")