from sqlmodel import SQLModel, text 
from app.core.database import engine

# Importujemy wszystkie modele, żeby baza wiedziała, co ma stworzyć
from app.models.user import User
from app.models.load import Load
from app.models.email_log import EmailLog

print("🔌 Włączanie rozszerzenia wektorowego dla sztucznej inteligencji (pgvector)...")
with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

print("🏗️ Budowanie fundamentów bazy danych...")
SQLModel.metadata.create_all(engine)
print("✅ Wszystkie tabele zostały pomyślnie utworzone!")