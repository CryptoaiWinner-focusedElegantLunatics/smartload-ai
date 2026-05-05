from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class AiChatMessage(SQLModel, table=True):
    """Wiadomość czatu AI — przechowuje historię rozmów użytkowników z Doradcą AI."""
    __tablename__ = "ai_chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: str  # "user" | "ai"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
