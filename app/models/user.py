from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SPEDYTOR = "SPEDYTOR"
    KIEROWCA = "KIEROWCA"


class User(SQLModel, table=True):
    """Model użytkownika systemu SmartLoad AI."""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default=UserRole.SPEDYTOR)
    vehicle_plate: Optional[str] = Field(default=None)
