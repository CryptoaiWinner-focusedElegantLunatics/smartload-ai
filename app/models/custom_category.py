from sqlmodel import SQLModel, Field
from typing import Optional

class CustomCategory(SQLModel, table=True):
    __tablename__ = "custom_categories"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    color: Optional[str] = Field(default="#64748b")
