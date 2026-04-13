from fastapi import APIRouter, HTTPException
from app.models.department import (
    CreateDepartmentRequest,
    UpdateDepartmentRequest,
    DepartmentResponse,
    DepartmentDetailedResponse,
    DepartmentResponseList,
    CurrencyTableResponseList,
    CurrencyTableResponse,
    CurrencyRate,
    MarkPaymentDto,
    MarkPaymentResponseDto,
)
from datetime import datetime, date
import uuid

router = APIRouter()

# --- In-memory stores ---
_departments: dict[str, DepartmentResponse] = {}
_payments: dict[str, MarkPaymentResponseDto] = {}


def _seed():
    deps = [
        DepartmentResponse(id="dep-0000-0001", name="Katowice", code="KTW", city="Katowice"),
        DepartmentResponse(id="dep-0000-0002", name="Gdańsk", code="GDN", city="Gdańsk"),
        DepartmentResponse(id="dep-0000-0003", name="Warszawa", code="WAW", city="Warszawa"),
    ]
    for d in deps:
        _departments[d.id] = d


_seed()


# --- Departments ---

@router.get("/departments", response_model=DepartmentResponseList)
def get_departments():
    items = list(_departments.values())
    return DepartmentResponseList(items=items, totalItems=len(items))


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(body: CreateDepartmentRequest):
    new_id = str(uuid.uuid4())
    dept = DepartmentResponse(id=new_id, name=body.name, code=body.code, city=body.city)
    _departments[new_id] = dept
    return dept


@router.get("/departments/{department_id}", response_model=DepartmentDetailedResponse)
def get_department(department_id: str):
    if department_id not in _departments:
        raise HTTPException(status_code=404, detail="Department not found")
    d = _departments[department_id]
    return DepartmentDetailedResponse(**d.dict(), speditors=[])


@router.post("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(department_id: str, body: UpdateDepartmentRequest):
    if department_id not in _departments:
        raise HTTPException(status_code=404, detail="Department not found")
    d = _departments[department_id]
    if body.name:
        d.name = body.name
    if body.code:
        d.code = body.code
    if body.city:
        d.city = body.city
    _departments[department_id] = d
    return d


# --- Currency tables ---

@router.get("/currency-tables", response_model=CurrencyTableResponseList)
def get_currency_tables():
    today = date.today().isoformat()
    table = CurrencyTableResponse(
        id="cur-table-001",
        name="NBP Table A",
        date=today,
        rates=[
            CurrencyRate(currencyCode="EUR", rate=4.28, baseCode="PLN"),
            CurrencyRate(currencyCode="USD", rate=3.95, baseCode="PLN"),
            CurrencyRate(currencyCode="GBP", rate=5.02, baseCode="PLN"),
            CurrencyRate(currencyCode="CHF", rate=4.41, baseCode="PLN"),
            CurrencyRate(currencyCode="CZK", rate=0.17, baseCode="PLN"),
        ],
    )
    return CurrencyTableResponseList(items=[table], totalItems=1)


# --- Payments ---

@router.put("/payment", response_model=MarkPaymentResponseDto)
def mark_payment(body: MarkPaymentDto):
    new_id = str(uuid.uuid4())
    response = MarkPaymentResponseDto(
        id=new_id,
        paid=body.paid,
        paymentDate=body.paymentDate or datetime.utcnow().isoformat(),
        amount=body.amount,
        currencyCode=body.currencyCode,
    )
    _payments[new_id] = response
    return response
