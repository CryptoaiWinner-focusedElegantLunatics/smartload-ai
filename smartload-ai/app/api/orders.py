from fastapi import APIRouter, HTTPException
from app.models.order import (
    OrderResponse,
    OrderList,
    CreateTransportOrderRequest,
    CreateTransportOrderResponse,
)
from datetime import datetime
import uuid

router = APIRouter()

# --- In-memory store ---
_orders: dict[str, OrderResponse] = {}
_transport_orders: dict[str, CreateTransportOrderResponse] = {}


def _seed():
    sample = [
        OrderResponse(
            id="ord-0000-0000-0000-000000000001",
            orderNumber="ZL/2026/001",
            status="IN_PROGRESS",
            atsStatus="ASSIGNED",
            cargoNames="Palety z elektroniką",
            carrierName="Trans-Pol Sp. z o.o.",
            client="Acme Corp",
            departmentName="Katowice",
            driverName="Jan Kowalski",
            truckRegistrationNumber="SL 12345",
            semitrailerRegistrationNumber="SL 99999",
            loadingsDescription="Katowice, ul. Przemysłowa 1",
            unloadingsDescription="Berlin, Industriestrasse 5",
            price="1800 EUR",
            createDate=datetime.utcnow().isoformat(),
            totalKm="850",
            totalWeightInKg="12000",
        ),
        OrderResponse(
            id="ord-0000-0000-0000-000000000002",
            orderNumber="ZL/2026/002",
            status="CREATED",
            atsStatus="CREATED",
            cargoNames="Mrożonki",
            carrierName="FastCargo GmbH",
            client="FoodEx S.A.",
            departmentName="Gdańsk",
            driverName="Piotr Nowak",
            truckRegistrationNumber="GD 54321",
            loadingsDescription="Gdańsk, ul. Portowa 10",
            unloadingsDescription="Amsterdam, Havenstraat 22",
            price="2400 EUR",
            createDate=datetime.utcnow().isoformat(),
            totalKm="1400",
            totalWeightInKg="8000",
        ),
    ]
    for o in sample:
        _orders[o.id] = o


_seed()


@router.get("/orders", response_model=OrderList)
def get_orders(pageNumber: int = 0, pageSize: int = 20, status: str = None):
    items = list(_orders.values())
    if status:
        items = [o for o in items if o.status == status]
    paged = items[pageNumber * pageSize: (pageNumber + 1) * pageSize]
    return OrderList(items=paged, totalItems=len(items))


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: str):
    if order_id not in _orders:
        raise HTTPException(status_code=404, detail="Order not found")
    return _orders[order_id]


@router.post("/transport-order", response_model=CreateTransportOrderResponse, status_code=201)
def create_transport_order(body: CreateTransportOrderRequest):
    new_id = str(uuid.uuid4())
    order_number = f"ZL/2026/{len(_transport_orders) + 100:03d}"

    response = CreateTransportOrderResponse(
        id=new_id,
        orderNumber=order_number,
        status="CREATED",
        loadIds=body.loadIds,
        truckId=body.truckId,
        createdAt=datetime.utcnow().isoformat(),
    )
    _transport_orders[new_id] = response

    # Also add to orders list
    _orders[new_id] = OrderResponse(
        id=new_id,
        orderNumber=order_number,
        status="CREATED",
        atsStatus="CREATED",
        truckRegistrationNumber=body.truckId,
        createDate=datetime.utcnow().isoformat(),
    )

    return response
