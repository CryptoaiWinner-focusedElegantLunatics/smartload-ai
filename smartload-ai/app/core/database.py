from sqlmodel import create_engine, Session
from app.core.config import settings

# Używamy właściwości get_db_url, która wie, co wybrać
engine = create_engine(settings.get_db_url, echo=True)

def get_session():
    with Session(engine) as session:
        yield session