from sqlmodel import Session
from sqlalchemy import text
from app.core.database import engine
from app.models.email_log import EmailLog


NEW_COLUMNS = [
    ("is_archived",    "BOOLEAN DEFAULT FALSE"),
    ("loading_city",   "VARCHAR"),
    ("loading_zip",    "VARCHAR"),
    ("unloading_city", "VARCHAR"),
    ("unloading_zip",  "VARCHAR"),
    ("weight_kg",      "INTEGER"),
    ("price",          "DOUBLE PRECISION"),
    ("currency",       "VARCHAR"),
]


def force_migrate():
    with Session(engine) as session:
        print("=" * 50)
        print("🚀 Bezpieczna migracja tabeli 'emaillog'")
        print("=" * 50)

        for col_name, col_type in NEW_COLUMNS:
            try:
                sql = f"ALTER TABLE emaillog ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                session.exec(text(sql))
                session.commit()
                print(f"  ✅ Kolumna '{col_name}' ({col_type}) — OK")
            except Exception as e:
                session.rollback()
                print(f"  ⚠️  Kolumna '{col_name}' — pominięto: {e}")

        print("=" * 50)
        print("🎉 Migracja zakończona! Dane nie zostały naruszone.")
        print("=" * 50)


if __name__ == "__main__":
    force_migrate()
