from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class AssignedRoute(SQLModel, table=True):
    """Trasa przypisana do kierowcy przez spedytora/admina."""
    __tablename__ = "assigned_routes"

    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(foreign_key="user.id", index=True)
    assigned_by_id: Optional[int] = Field(default=None, foreign_key="user.id")  # kto przypisał
    source_id: Optional[str] = Field(default=None)  # UID maila lub oferty

    loading_city: str
    unloading_city: str
    weight_kg: float = Field(default=0.0)
    price: float = Field(default=0.0)
    status: str = Field(default="PRZYPISANE")  # PRZYPISANE | W DRODZE | ROZŁADOWANE
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
