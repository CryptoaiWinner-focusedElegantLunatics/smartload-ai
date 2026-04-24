from typing import Optional
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    """Model użytkownika systemu SmartLoad AI."""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
