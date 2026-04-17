from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.models.load import Load
from typing import Optional, List
from sqlmodel import SQLModel
from datetime import datetime
import uuid

router = APIRouter()


# --- fireTMS-compatible request/response models ---

class PublicApiClientOrderCargo(SQLModel):
    description: Optional[str] = None
    weightKg: Optional[float] = None
    ldm: Optional[float] = None
    quantity: Optional[int] = None
    cargoType: Optional[str] = None


class PublicApiClientOrderAddress(SQLModel):
    city: Optional[str] = None
    country: Optional[str] = None
    postalCode: Optional[str] = None
    street: Optional[str] = None
    date: Optional[str] = None  # $date-time


class MoneyDto(SQLModel):
    amount: Optional[float] = None
    currencyCode: Optional[str] = "EUR"


class PublicApiClientOrderDto(SQLModel):
    """fireTMS-compatible client order (load) structure"""
    id: Optional[str] = None
    clientOrderNumber: Optional[str] = None
    internalNote: Optional[str] = None
    price: Optional[MoneyDto] = None
    receptionDate: Optional[str] = None  # $date-time
    # Simplified address fields mapped from our Load model
    origin: Optional[str] = None
    destination: Optional[str] = None
    weightKg: Optional[float] = None
    category: Optional[str] = None
    source: Optional[str] = None
    scrapedAt: Optional[str] = None
    url: Optional[str] = None


class PublicApiOwnClientOrderDto(SQLModel):
    clientOrderNumber: str
    origin: str
    destination: str
    internalNote: Optional[str] = None
    price: Optional[MoneyDto] = None
    weightKg: Optional[float] = None
    category: Optional[str] = None


class ClientOrderResponseList(SQLModel):
    items: List[PublicApiClientOrderDto] = []
    totalItems: int = 0
    pageNumber: int = 0
    pageSize: int = 20


def _load_to_dto(load: Load) -> PublicApiClientOrderDto:
    return PublicApiClientOrderDto(
        id=str(load.id),
        clientOrderNumber=load.offer_id or f"ORD-{load.id}",
        origin=load.origin,
        destination=load.destination,
        internalNote=load.title,
        price=MoneyDto(amount=load.price, currencyCode="EUR") if load.price else None,
        weightKg=load.weight_kg,
        category=load.category,
        source=load.source,
        scrapedAt=load.scraped_at.isoformat() if load.scraped_at else None,
        url=load.url,
        receptionDate=load.scraped_at.isoformat() if load.scraped_at else None,
    )


@router.get("/loads", response_model=ClientOrderResponseList)
def get_loads(
    session: Session = Depends(get_session),
    limit: int = 20,
    pageNumber: int = 0,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    source: Optional[str] = None,
):
    query = select(Load)
    if origin:
        query = query.where(Load.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.where(Load.destination.ilike(f"%{destination}%"))
    if source:
        query = query.where(Load.source == source)

    all_loads = session.exec(query).all()
    paged = all_loads[pageNumber * limit: (pageNumber + 1) * limit]
    items = [_load_to_dto(l) for l in paged]

    return ClientOrderResponseList(
        items=items,
        totalItems=len(all_loads),
        pageNumber=pageNumber,
        pageSize=limit,
    )


@router.get("/loads/{load_id}", response_model=PublicApiClientOrderDto)
def get_load(load_id: int, session: Session = Depends(get_session)):
    load = session.get(Load, load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")
    return _load_to_dto(load)


@router.post("/loads", response_model=PublicApiClientOrderDto, status_code=201)
def create_load(body: PublicApiClientOrderDto, session: Session = Depends(get_session)):
    load = Load(
        origin=body.origin or "",
        destination=body.destination or "",
        title=body.internalNote,
        price=body.price.amount if body.price else None,
        weight_kg=body.weightKg,
        category=body.category,
        offer_id=body.clientOrderNumber,
        source="manual",
        scraped_at=datetime.utcnow(),
    )
    session.add(load)
    session.commit()
    session.refresh(load)
    return _load_to_dto(load)


@router.post("/loads/own", response_model=PublicApiClientOrderDto, status_code=201)
def create_own_load(body: PublicApiOwnClientOrderDto, session: Session = Depends(get_session)):
    load = Load(
        origin=body.origin,
        destination=body.destination,
        title=body.internalNote,
        price=body.price.amount if body.price else None,
        weight_kg=body.weightKg,
        category=body.category,
        offer_id=body.clientOrderNumber,
        source="own",
        scraped_at=datetime.utcnow(),
    )
    session.add(load)
    session.commit()
    session.refresh(load)
    return _load_to_dto(load)
