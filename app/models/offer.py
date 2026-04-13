from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field
import uuid


class MoneyDto(SQLModel):
    amount: Optional[float] = None
    currencyCode: Optional[str] = "EUR"


class PublicApiOfferCargoHandling(SQLModel):
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    date: Optional[str] = None  # $date-time
    postalCode: Optional[str] = None
    type: Optional[str] = None  # LOADING / UNLOADING


class PublicApiClientOrderClient(SQLModel):
    taxId: Optional[str] = None
    vatEuId: Optional[str] = None


class PublicApiOfferDto(SQLModel):
    cargos: Optional[List[dict]] = None
    client: Optional[PublicApiClientOrderClient] = None
    description: Optional[str] = None
    expireDate: Optional[str] = None  # $date-time, example: 2025-05-15
    externalId: Optional[str] = None
    loadingSpot: Optional[PublicApiOfferCargoHandling] = None
    price: Optional[MoneyDto] = None
    semitrailerType: Optional[List[str]] = None
    unloadSpot: Optional[PublicApiOfferCargoHandling] = None


class PublicApiPaymentDetailsDto(SQLModel):
    paymentDays: Optional[int] = None
    paymentType: Optional[str] = None  # e.g. DAYS_FROM_INVOICE


class PublicApiPublicationOnExchangeDetailsDto(SQLModel):
    paymentDetails: Optional[PublicApiPaymentDetailsDto] = None
    publishOnFireXgo: Optional[bool] = False


class CreateOfferDto(SQLModel):
    exchangeDetails: Optional[PublicApiPublicationOnExchangeDetailsDto] = None
    offer: Optional[PublicApiOfferDto] = None


class CreateOfferResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    externalId: Optional[str] = None
    status: Optional[str] = "CREATED"


class UpdateOfferRequest(SQLModel):
    offer: Optional[PublicApiOfferDto] = None


class UpdateOfferPublicationRequest(SQLModel):
    exchangeDetails: Optional[PublicApiPublicationOnExchangeDetailsDto] = None


class OfferRecord(SQLModel):
    """Internal storage model for offers"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    offer: Optional[PublicApiOfferDto] = None
    exchangeDetails: Optional[PublicApiPublicationOnExchangeDetailsDto] = None
    status: str = "ACTIVE"
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    publications: Optional[dict] = None  # keyed by exchangeOfferId
