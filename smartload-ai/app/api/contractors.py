from fastapi import APIRouter, HTTPException
from typing import List
from app.models.contractor import (
    ContractorApiList,
    ContractorResponse,
    ContractorBankAccountResponseList,
    BankAccountApiDto,
    CreateContractorRequest,
    PublicApiPaging,
)
import uuid

router = APIRouter()

# --- In-memory store (replace with DB later) ---
_contractors: dict[str, ContractorResponse] = {}
_bank_accounts: dict[str, List[BankAccountApiDto]] = {}


def _seed():
    """Seed some sample contractors on startup"""
    sample = [
        ContractorResponse(
            id="c1-0000-0000-0000-000000000001",
            name="Trans-Pol Sp. z o.o.",
            shortName="Trans-Pol",
            taxId="1234567890",
            vatEuId="PL1234567890",
            officialArea="Śląskie",
        ),
        ContractorResponse(
            id="c1-0000-0000-0000-000000000002",
            name="FastCargo GmbH",
            shortName="FastCargo",
            taxId="DE123456789",
            vatEuId="DE123456789",
            officialArea="Bayern",
        ),
        ContractorResponse(
            id="c1-0000-0000-0000-000000000003",
            name="Spedition Kowalski",
            shortName="Kowalski",
            taxId="9876543210",
            vatEuId="PL9876543210",
            officialArea="Mazowieckie",
        ),
    ]
    for c in sample:
        _contractors[c.id] = c
    _bank_accounts["c1-0000-0000-0000-000000000001"] = [
        BankAccountApiDto(accountNumber="PL61109010140000071219812874", bankName="PKO BP", currency="PLN", swift="BPKOPLPW")
    ]


_seed()


@router.get("/contractors", response_model=ContractorApiList)
def get_contractors(pageNumber: int = 0, pageSize: int = 20):
    items = list(_contractors.values())
    paged = items[pageNumber * pageSize: (pageNumber + 1) * pageSize]
    return ContractorApiList(
        items=paged,
        paging=PublicApiPaging(pageNumber=pageNumber, pageSize=pageSize),
        totalItems=len(items),
    )


@router.get("/contractors/count")
def count_contractors():
    return {"count": len(_contractors)}


@router.get("/contractors/{contractor_id}/bank-accounts", response_model=ContractorBankAccountResponseList)
def get_bank_accounts(contractor_id: str):
    if contractor_id not in _contractors:
        raise HTTPException(status_code=404, detail="Contractor not found")
    accounts = _bank_accounts.get(contractor_id, [])
    return ContractorBankAccountResponseList(items=accounts, totalItems=len(accounts))


@router.post("/contractors", response_model=ContractorResponse, status_code=201)
def create_contractor(body: CreateContractorRequest):
    new_id = str(uuid.uuid4())
    contractor = ContractorResponse(
        id=new_id,
        name=body.name,
        shortName=body.shortName,
        taxId=body.taxId,
        vatEuId=body.vatEuId,
        regon=body.regon,
        officialArea=body.officialArea,
        subOfficialArea=body.subOfficialArea,
        primaryAddress=body.primaryAddress,
        paymentTermForCarrier=body.paymentTermForCarrier,
        paymentTermForClient=body.paymentTermForClient,
        contactPersons=body.contactPersons,
        timocomId=body.timocomId,
        transEuId=body.transEuId,
    )
    _contractors[new_id] = contractor
    return contractor
