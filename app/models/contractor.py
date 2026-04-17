from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON
import uuid


class AddressApiDto(SQLModel):
    city: Optional[str] = None
    country: Optional[str] = None
    postalCode: Optional[str] = None
    street: Optional[str] = None


class PaymentTermApiDto(SQLModel):
    basePoint: Optional[str] = None  # Enum: INVOICE_RECEIPT, DELIVERY_DATE, ORDER_DATE
    daysOffset: Optional[int] = None
    offsetType: Optional[str] = None  # Enum: SET_AMOUNT_OF_DAYS, END_OF_MONTH, END_OF_NEXT_MONTH


class ContactPersonApiDto(SQLModel):
    email: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None


class CreateContractorRequest(SQLModel):
    contactPersons: Optional[List[ContactPersonApiDto]] = None
    name: str
    officialArea: Optional[str] = None
    paymentTermForCarrier: Optional[PaymentTermApiDto] = None
    paymentTermForClient: Optional[PaymentTermApiDto] = None
    primaryAddress: Optional[AddressApiDto] = None
    regon: Optional[str] = None
    shortName: Optional[str] = None
    subOfficialArea: Optional[str] = None
    taxId: Optional[str] = None
    timocomId: Optional[str] = None
    transEuId: Optional[str] = None
    vatEuId: Optional[str] = None


class BankAccountApiDto(SQLModel):
    accountNumber: Optional[str] = None
    bankName: Optional[str] = None
    currency: Optional[str] = None
    swift: Optional[str] = None


class ContractorResponse(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    shortName: Optional[str] = None
    taxId: Optional[str] = None
    vatEuId: Optional[str] = None
    regon: Optional[str] = None
    officialArea: Optional[str] = None
    subOfficialArea: Optional[str] = None
    primaryAddress: Optional[AddressApiDto] = None
    paymentTermForCarrier: Optional[PaymentTermApiDto] = None
    paymentTermForClient: Optional[PaymentTermApiDto] = None
    contactPersons: Optional[List[ContactPersonApiDto]] = None
    timocomId: Optional[str] = None
    transEuId: Optional[str] = None


class PublicApiPaging(SQLModel):
    pageNumber: int = 0
    pageSize: int = 20


class ContractorApiList(SQLModel):
    items: List[ContractorResponse] = []
    paging: Optional[PublicApiPaging] = None
    totalItems: int = 0


class ContractorBankAccountResponseList(SQLModel):
    items: List[BankAccountApiDto] = []
    totalItems: int = 0
