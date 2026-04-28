"""
Seeder ról RBAC — SmartLoad AI
Tworzy konta: 1x ADMIN, 3x SPEDYTOR, 5x KIEROWCA.
Nie usuwa istniejących użytkowników — działa idempotentnie (pomija duplikaty).
"""
from sqlmodel import Session, select
from app.core.database import engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole


ACCOUNTS = [
    # (username, password, role, vehicle_plate)
    ("admin@smartload.ai",      "admin123", UserRole.ADMIN,    None),
    ("spedytor1@smartload.ai",  "sped123",  UserRole.SPEDYTOR, None),
    ("spedytor2@smartload.ai",  "sped123",  UserRole.SPEDYTOR, None),
    ("spedytor3@smartload.ai",  "sped123",  UserRole.SPEDYTOR, None),
    ("kierowca1@smartload.ai",  "kier123",  UserRole.KIEROWCA, "WA 1234K"),
    ("kierowca2@smartload.ai",  "kier123",  UserRole.KIEROWCA, "GD 5678K"),
    ("kierowca3@smartload.ai",  "kier123",  UserRole.KIEROWCA, "KR 9012K"),
    ("kierowca4@smartload.ai",  "kier123",  UserRole.KIEROWCA, "PO 3456K"),
    ("kierowca5@smartload.ai",  "kier123",  UserRole.KIEROWCA, "WR 7890K"),
]


def seed_roles():
    """Tworzy konta testowe dla każdej roli. Idempotentne."""
    print("🌱 Seeding role accounts...")

    with Session(engine) as session:
        # Upewnij się, że istniejące konto 'admin' ma rolę ADMIN
        existing_admin = session.exec(
            select(User).where(User.username == "admin")
        ).first()
        if existing_admin and existing_admin.role != UserRole.ADMIN:
            existing_admin.role = UserRole.ADMIN
            session.add(existing_admin)
            session.commit()
            print("✅ Zaktualizowano rolę istniejącego konta 'admin' → ADMIN")

        for username, password, role, plate in ACCOUNTS:
            exists = session.exec(
                select(User).where(User.username == username)
            ).first()

            if exists:
                print(f"⏭️  Pominięto (już istnieje): {username}")
                continue

            user = User(
                username=username,
                hashed_password=get_password_hash(password),
                role=role,
                vehicle_plate=plate,
            )
            session.add(user)
            print(f"✅ Dodano: {username} [{role}]" + (f" | {plate}" if plate else ""))

        session.commit()

    print("✅ Seeding zakończony.")


if __name__ == "__main__":
    seed_roles()
