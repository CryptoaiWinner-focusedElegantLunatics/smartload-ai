from fastapi import APIRouter, HTTPException
from app.models.offer import (
    CreateOfferDto,
    CreateOfferResponse,
    OfferRecord,
    UpdateOfferRequest,
    UpdateOfferPublicationRequest,
    PublicApiPublicationOnExchangeDetailsDto,
)
import uuid
from datetime import datetime

router = APIRouter()

# --- In-memory store ---
_offers: dict[str, OfferRecord] = {}


def _seed():
    sample_offers = [
        OfferRecord(
            id="of-0000-0000-0000-000000000001",
            offer={
                "description": "Ładunek paletowy Katowice → Berlin",
                "expireDate": "2026-04-20T12:00:00",
                "externalId": "EXT-001",
                "price": {"amount": 1800, "currencyCode": "EUR"},
                "semitrailerType": ["CURTAINSIDER"],
                "loadingSpot": {"city": "Katowice", "country": "PL", "date": "2026-04-15T08:00:00"},
                "unloadSpot": {"city": "Berlin", "country": "DE", "date": "2026-04-16T14:00:00"},
            },
            status="ACTIVE",
            createdAt=datetime.utcnow().isoformat(),
        ),
        OfferRecord(
            id="of-0000-0000-0000-000000000002",
            offer={
                "description": "Chłodnia Gdańsk → Amsterdam",
                "expireDate": "2026-04-18T09:00:00",
                "externalId": "EXT-002",
                "price": {"amount": 2400, "currencyCode": "EUR"},
                "semitrailerType": ["REFRIGERATOR"],
                "loadingSpot": {"city": "Gdańsk", "country": "PL", "date": "2026-04-16T07:00:00"},
                "unloadSpot": {"city": "Amsterdam", "country": "NL", "date": "2026-04-18T10:00:00"},
            },
            status="ACTIVE",
            createdAt=datetime.utcnow().isoformat(),
        ),
    ]
    for o in sample_offers:
        _offers[o.id] = o


_seed()


@router.post("/offers", response_model=CreateOfferResponse, status_code=201)
def create_offer(body: CreateOfferDto):
    new_id = str(uuid.uuid4())
    record = OfferRecord(
        id=new_id,
        offer=body.offer,
        exchangeDetails=body.exchangeDetails,
        status="ACTIVE",
        createdAt=datetime.utcnow().isoformat(),
        publications={},
    )
    _offers[new_id] = record
    return CreateOfferResponse(
        id=new_id,
        externalId=body.offer.externalId if body.offer else None,
        status="CREATED",
    )


@router.get("/offers", response_model=list[dict])
def list_offers():
    return [o.dict() for o in _offers.values()]


@router.get("/offers/{tms_offer_id}")
def get_offer(tms_offer_id: str):
    if tms_offer_id not in _offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    return _offers[tms_offer_id].dict()


@router.put("/offers/{tms_offer_id}", response_model=CreateOfferResponse)
def update_offer(tms_offer_id: str, body: UpdateOfferRequest):
    if tms_offer_id not in _offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    record = _offers[tms_offer_id]
    if body.offer:
        record.offer = body.offer
    _offers[tms_offer_id] = record
    return CreateOfferResponse(id=tms_offer_id, status="UPDATED")


@router.put("/offers/{tms_offer_id}/publications/{exchange_offer_id}", response_model=dict)
def update_offer_publication(
    tms_offer_id: str,
    exchange_offer_id: str,
    body: UpdateOfferPublicationRequest,
):
    if tms_offer_id not in _offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    record = _offers[tms_offer_id]
    if record.publications is None:
        record.publications = {}
    record.publications[exchange_offer_id] = body.dict()
    _offers[tms_offer_id] = record
    return {"tmsOfferId": tms_offer_id, "exchangeOfferId": exchange_offer_id, "status": "UPDATED"}


@router.delete("/offers/{tms_offer_id}", status_code=204)
def delete_offer(tms_offer_id: str):
    if tms_offer_id not in _offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    del _offers[tms_offer_id]


@router.delete("/offers/{tms_offer_id}/publications/{exchange_offer_id}", status_code=204)
def delete_offer_publication(tms_offer_id: str, exchange_offer_id: str):
    if tms_offer_id not in _offers:
        raise HTTPException(status_code=404, detail="Offer not found")
    record = _offers[tms_offer_id]
    if record.publications and exchange_offer_id in record.publications:
        del record.publications[exchange_offer_id]
    _offers[tms_offer_id] = record
