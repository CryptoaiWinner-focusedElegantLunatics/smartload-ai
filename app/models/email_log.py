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
    received_at: datetime = Field(default_factory=datetime.utcnow)