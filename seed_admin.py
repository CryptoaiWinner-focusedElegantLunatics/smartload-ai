"""
Skrypt do generowania domyślnego konta administratora.
uruchom przez: docker compose exec backend python seed_admin.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import SQLModel, Session, select, create_engine
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.email_log import EmailLog
from app.models.load import Load

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

def seed():
    engine = create_engine(settings.DATABASE_URL, echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        existing = session.exec(
            select(User).where(User.username == ADMIN_USERNAME)
        ).first()

        if existing:
            print(f"✅ Użytkownik '{ADMIN_USERNAME}' już istnieje.")
            return

        admin = User(
            username=ADMIN_USERNAME,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
        )
        session.add(admin)
        session.commit()
        print(f"🚀 Utworzono administratora: login='{ADMIN_USERNAME}', hasło='{ADMIN_PASSWORD}'")

if __name__ == "__main__":
    seed()
