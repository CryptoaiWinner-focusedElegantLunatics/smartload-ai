from typing import Optional, List
from sqlmodel import SQLModel, Field
import uuid


# --- Departments ---

class CreateDepartmentRequest(SQLModel):
    name: str
    code: Optional[str] = None
    city: Optional[str] = None


class UpdateDepartmentRequest(SQLModel):
    name: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None


class DepartmentResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: Optional[str] = None
    city: Optional[str] = None


class DepartmentDetailedResponse(DepartmentResponse):
    speditors: Optional[List[str]] = None


class DepartmentResponseList(SQLModel):
    items: List[DepartmentResponse] = []
    totalItems: int = 0


# --- Currency ---

class CurrencyRate(SQLModel):
    currencyCode: str
    rate: float
    baseCode: str = "PLN"


class CurrencyTableResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    date: Optional[str] = None
    rates: List[CurrencyRate] = []


class CurrencyTableResponseList(SQLModel):
    items: List[CurrencyTableResponse] = []
    totalItems: int = 0


# --- Payment ---

class MarkPaymentDto(SQLModel):
    invoiceId: Optional[str] = None
    orderId: Optional[str] = None
    paid: bool = True
    paymentDate: Optional[str] = None
    amount: Optional[float] = None
    currencyCode: Optional[str] = "PLN"


class MarkPaymentResponseDto(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paid: bool
    paymentDate: Optional[str] = None
    amount: Optional[float] = None
    currencyCode: Optional[str] = None
