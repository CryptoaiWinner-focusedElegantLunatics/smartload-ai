from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from pgvector.sqlalchemy import Vector


class Load(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # lokalizacja
    origin: str
    destination: str

    # dane o ładunku
    # title: Optional[str] = None
    weight_kg: Optional[float] = None
    category: Optional[str] = None

    # cena
    price: Optional[float] = None
    price_raw: Optional[str] = None

    # źródło
    offer_id: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    scraped_at: Optional[datetime] = None

    # AI embedding
    embedding: Optional[list[float]] = Field(
        default=None,
        sa_column=Column(Vector(1536))
    )
