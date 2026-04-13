from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field
import uuid


class OrderResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: Optional[str] = None
    atsStatus: Optional[str] = None
    # Enum: CREATED, ASSIGNED, IN_TRANSIT, COMPLETED, CANCELLED, etc.
    cargoNames: Optional[str] = None
    carrierName: Optional[str] = None
    client: Optional[str] = None
    clientOrderNumbers: Optional[str] = None
    clientOrderSpeditors: Optional[str] = None
    clientPricePerLoadedKm: Optional[str] = None
    clientPricePerTotalKm: Optional[str] = None
    clientPrices: Optional[str] = None
    completionRiskDto: Optional[str] = None
    contactPerson: Optional[str] = None
    contactPhone: Optional[str] = None
    createDate: Optional[str] = None  # $date-time
    departmentName: Optional[str] = None
    driverName: Optional[str] = None
    emptyKm: Optional[str] = None
    expenses: Optional[str] = None
    lastAtsStatusChangeCause: Optional[str] = None
    loadedKm: Optional[str] = None
    loadingsDescription: Optional[str] = None
    mileageOutsideCorridor: Optional[float] = None
    notes: Optional[str] = None
    price: Optional[str] = None
    provision: Optional[str] = None
    realEmptyMileage: Optional[float] = None
    realLoadedMileage: Optional[float] = None
    realMileage: Optional[float] = None
    secondDriverName: Optional[str] = None
    semitrailerRegistrationNumber: Optional[str] = None
    speditor: Optional[str] = None
    status: Optional[str] = None
    # Enum: CREATED, IN_PROGRESS, COMPLETED, CANCELLED, etc.
    subStatuses: Optional[str] = None
    tags: Optional[str] = None
    totalKm: Optional[str] = None
    totalLdm: Optional[str] = None
    totalWeightInKg: Optional[str] = None
    truckRegistrationNumber: Optional[str] = None
    truckStatus: Optional[str] = None
    unloadingsDescription: Optional[str] = None


class OrderList(SQLModel):
    items: List[OrderResponse] = []
    paging: Optional[dict] = None
    totalItems: int = 0


class CreateTransportOrderRequest(SQLModel):
    loadIds: List[str]
    truckId: str  # example: b9bc1394-6692-463b-85f7-f96bac02c461


class CreateTransportOrderResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: Optional[str] = None
    status: str = "CREATED"
    loadIds: Optional[List[str]] = None
    truckId: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
