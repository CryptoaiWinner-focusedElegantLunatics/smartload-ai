from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class EmailLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uid: str = Field(unique=True, index=True)
    sender: str
    subject: str
    body: str
    ai_category: Optional[str] = Field(default=None)
    is_deleted: bool = Field(default=False)
    is_archived: bool = Field(default=False)
    received_at: datetime = Field(default_factory=datetime.utcnow)

    # Dane ładunku wyciągnięte przez AI
    loading_city: Optional[str] = Field(default=None)
    loading_zip: Optional[str] = Field(default=None)
    unloading_city: Optional[str] = Field(default=None)
    unloading_zip: Optional[str] = Field(default=None)
    weight_kg: Optional[int] = Field(default=None)
    price: Optional[float] = Field(default=None)
    currency: Optional[str] = Field(default=None)