from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from pgvector.sqlalchemy import Vector

class Load(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    origin: str
    destination: str
    price: float
    
    embedding: Optional[list[float]] = Field(default=None, sa_column=Column(Vector(1536)))