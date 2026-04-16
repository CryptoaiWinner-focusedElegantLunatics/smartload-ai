import os
from sqlmodel import Session, select
from app.database import engine
from app.models.user import User
from app.core.security import get_password_hash

def create_superuser():
    # Pobieramy dane z panelu Railway, z fallbackiem na standardowe wartości
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")

    with Session(engine) as session:
        # Sprawdzamy, czy użytkownik o takim loginie już istnieje
        user = session.exec(select(User).where(User.username == admin_user)).first()
        
        if not user:
            hashed_password = get_password_hash(admin_pass)
            new_admin = User(username=admin_user, hashed_password=hashed_password)
            session.add(new_admin)
            session.commit()
            print(f"✅ Utworzono admina z loginem: {admin_user} (hasło z Variables)")
        else:
            print(f"⚠️ Użytkownik {admin_user} już istnieje w bazie.")

if __name__ == "__main__":
    create_superuser()