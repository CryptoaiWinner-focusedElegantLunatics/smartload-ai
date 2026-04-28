from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class ChatMessage(SQLModel, table=True):
    """Wiadomość czatu między użytkownikami systemu."""
    __tablename__ = "chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: int = Field(foreign_key="user.id", index=True)
    receiver_id: int = Field(foreign_key="user.id", index=True)
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = Field(default=False)
