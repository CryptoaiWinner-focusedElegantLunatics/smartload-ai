from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import io

from app.core.database import engine
from app.core.security import RoleChecker, get_current_user
from app.models.user import User, UserRole
from app.models.assigned_route import AssignedRoute
from app.models.document_schema import ParsedDocument
from app.services.cmr_generator import generate_cmr_pdf

router = APIRouter(prefix="/api", tags=["routes"])


# ─── Schematy ──────────────────────────────────────────────
class DriverOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    vehicle_plate: Optional[str]

    class Config:
        from_attributes = True


class AssignRouteIn(BaseModel):
    driver_id: int
    source_id: Optional[str] = None
    loading_city: str
    unloading_city: str
    weight_kg: float = 0.0
    price: float = 0.0


class AssignByEmailIn(BaseModel):
    """Payload do przypisania trasy po emailu/username kierowcy."""
    driver_email: str          # email lub username kierowcy
    loading_city: str
    unloading_city: str
    weight_kg: float = 0.0
    price: float = 0.0
    source_id: Optional[str] = None


class RouteOut(BaseModel):
    id: int
    driver_id: int
    assigned_by_id: Optional[int] = None
    source_id: Optional[str]
    loading_city: str
    unloading_city: str
    weight_kg: float
    price: float
    status: str
    assigned_at: datetime

    class Config:
        from_attributes = True


class RouteOutExtended(RouteOut):
    """RouteOut z e-mailem osoby, która przypisała trasę."""
    assigned_by_email: Optional[str] = None


class StatusPatch(BaseModel):
    status: str  # "PRZYPISANE" | "W DRODZE" | "ROZŁADOWANE"


class ActiveRouteInfo(BaseModel):
    loading_city: str
    unloading_city: str
    weight_kg: float
    status: str


class DriverContextOut(BaseModel):
    driver_id: int
    username: str
    vehicle_plate: Optional[str]
    active_route: Optional[ActiveRouteInfo]


# ─── Endpointy ─────────────────────────────────────────────

@router.get("/drivers", response_model=List[DriverOut])
def list_drivers(
    _user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR"])),
):
    """Zwraca listę kierowców (rola KIEROWCA)."""
    with Session(engine) as session:
        drivers = session.exec(
            select(User).where(User.role == UserRole.KIEROWCA)
        ).all()
    return drivers


@router.post("/routes/assign", response_model=RouteOut, status_code=201)
def assign_route(
    payload: AssignRouteIn,
    _user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR"])),
):
    """Przypisuje trasę do kierowcy."""
    with Session(engine) as session:
        # Weryfikacja, że driver_id istnieje i jest KIEROWCĄ
        driver = session.get(User, payload.driver_id)
        if not driver or driver.role != UserRole.KIEROWCA:
            raise HTTPException(
                status_code=404, detail="Kierowca nie znaleziony lub nieprawidłowa rola."
            )

        route = AssignedRoute(
            driver_id=payload.driver_id,
            source_id=payload.source_id,
            loading_city=payload.loading_city,
            unloading_city=payload.unloading_city,
            weight_kg=payload.weight_kg,
            price=payload.price,
            assigned_by_id=_user.id,
            status="PRZYPISANE",
        )
        session.add(route)
        session.commit()
        session.refresh(route)
        return RouteOut(
            id=route.id, driver_id=route.driver_id, assigned_by_id=route.assigned_by_id,
            source_id=route.source_id, loading_city=route.loading_city,
            unloading_city=route.unloading_city, weight_kg=route.weight_kg,
            price=route.price, status=route.status, assigned_at=route.assigned_at,
        )


@router.post("/routes/assign-by-email", response_model=RouteOutExtended, status_code=201)
def assign_route_by_email(
    payload: AssignByEmailIn,
    current_user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR"])),
):
    """
    Przypisuje trasę do kierowcy wyszukanego po emailu LUB username.
    Zwraca trasę z informacją kto przypisal (assigned_by_email).
    """
    with Session(engine) as session:
        # Szukaj po username lub email
        driver = session.exec(
            select(User).where(
                (User.username == payload.driver_email) |
                (User.email == payload.driver_email)
            )
        ).first()

        if not driver:
            raise HTTPException(status_code=404, detail=f"Nie znaleziono użytkownika '{payload.driver_email}'.")
        if driver.role != UserRole.KIEROWCA:
            raise HTTPException(status_code=400, detail=f"Użytkownik '{driver.username}' nie ma roli KIEROWCA.")


        route = AssignedRoute(
            driver_id=driver.id,
            assigned_by_id=current_user.id,
            source_id=payload.source_id,
            loading_city=payload.loading_city,
            unloading_city=payload.unloading_city,
            weight_kg=payload.weight_kg,
            price=payload.price,
            status="PRZYPISANE",
        )
        session.add(route)
        session.commit()
        session.refresh(route)

        result = RouteOutExtended(
            id=route.id, driver_id=route.driver_id, assigned_by_id=route.assigned_by_id,
            source_id=route.source_id, loading_city=route.loading_city,
            unloading_city=route.unloading_city, weight_kg=route.weight_kg,
            price=route.price, status=route.status, assigned_at=route.assigned_at,
            assigned_by_email=current_user.email or current_user.username,
        )

    # Powiadomienie WS do kierowcy
    try:
        import asyncio
        from app.api.chat import chat_manager
        notif = {
            "type": "notification",
            "message": f"🚛 Nowa trasa przypisana przez {current_user.email or current_user.username}! "
                       f"{payload.loading_city} → {payload.unloading_city}. Sprawdź panel Moje Trasy.",
        }
        loop = asyncio.get_event_loop()
        asyncio.run_coroutine_threadsafe(chat_manager.send_to_user(driver.id, notif), loop)
    except Exception:
        pass

    return result


@router.get("/routes/my-routes", response_model=List[RouteOutExtended])
def my_routes(
    current_user: User = Depends(RoleChecker(["KIEROWCA", "ADMIN"])),
):
    """Zwraca trasy przypisane do zalogowanego kierowcy (lub wszystkie dla ADMINA)."""
    with Session(engine) as session:
        if current_user.role == UserRole.ADMIN:
            routes = session.exec(
                select(AssignedRoute).order_by(AssignedRoute.assigned_at.desc())
            ).all()
        else:
            routes = session.exec(
                select(AssignedRoute)
                .where(AssignedRoute.driver_id == current_user.id)
                .order_by(AssignedRoute.assigned_at.desc())
            ).all()

        # Zbuduj wynik z email osoby przypisującej — wewnątrz sesji!
        result = []
        for r in routes:
            assigned_by_email = None
            if r.assigned_by_id:
                assigner = session.get(User, r.assigned_by_id)
                if assigner:
                    assigned_by_email = assigner.email or assigner.username
            result.append(RouteOutExtended(
                id=r.id, driver_id=r.driver_id, assigned_by_id=r.assigned_by_id,
                source_id=r.source_id, loading_city=r.loading_city,
                unloading_city=r.unloading_city, weight_kg=r.weight_kg,
                price=r.price, status=r.status, assigned_at=r.assigned_at,
                assigned_by_email=assigned_by_email,
            ))
    return result


@router.patch("/routes/{route_id}/status", response_model=RouteOut)
def update_route_status(
    route_id: int,
    payload: StatusPatch,
    current_user: User = Depends(RoleChecker(["KIEROWCA", "ADMIN"])),
):
    """Aktualizuje status trasy (KIEROWCA może aktualizować tylko swoje trasy)."""
    ALLOWED_STATUSES = {"PRZYPISANE", "W DRODZE", "ROZŁADOWANE"}
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Nieprawidłowy status. Dozwolone: {', '.join(ALLOWED_STATUSES)}",
        )

    with Session(engine) as session:
        route = session.get(AssignedRoute, route_id)
        if not route:
            raise HTTPException(status_code=404, detail="Trasa nie znaleziona.")

        # Kierowca może zmieniać tylko swoje trasy
        if current_user.role == UserRole.KIEROWCA and route.driver_id != current_user.id:
            raise HTTPException(status_code=403, detail="Brak dostępu do tej trasy.")

        route.status = payload.status
        session.add(route)
        session.commit()
        session.refresh(route)
        return route


@router.get("/chat/driver-context/{driver_id}", response_model=DriverContextOut)
def get_driver_context(
    driver_id: int,
    _user: User = Depends(RoleChecker(["ADMIN", "SPEDYTOR", "KIEROWCA"])),
):
    """Zwraca kontekst kierowcy: numer rejestracyjny + aktywna trasa."""
    with Session(engine) as session:
        driver = session.get(User, driver_id)
        if not driver or driver.role != UserRole.KIEROWCA:
            raise HTTPException(status_code=404, detail="Kierowca nie znaleziony.")

        # Pobierz najnowszą aktywną trasę (PRZYPISANE lub W DRODZE)
        active_route = session.exec(
            select(AssignedRoute)
            .where(AssignedRoute.driver_id == driver_id)
            .where(AssignedRoute.status.in_(["PRZYPISANE", "W DRODZE"]))  # type: ignore[attr-defined]
            .order_by(AssignedRoute.assigned_at.desc())
        ).first()

        return DriverContextOut(
            driver_id=driver.id,
            username=driver.username,
            vehicle_plate=driver.vehicle_plate,
            active_route=ActiveRouteInfo(
                loading_city=active_route.loading_city,
                unloading_city=active_route.unloading_city,
                weight_kg=active_route.weight_kg,
                status=active_route.status,
            ) if active_route else None,
        )


@router.get("/routes/{route_id}/cmr")
def generate_route_cmr(
    route_id: int,
    current_user: User = Depends(RoleChecker(["KIEROWCA", "SPEDYTOR", "ADMIN"])),
):
    """Generuje i pobiera list przewozowy CMR dla danej trasy jako PDF."""
    with Session(engine) as session:
        route = session.get(AssignedRoute, route_id)
        if not route:
            raise HTTPException(status_code=404, detail="Trasa nie znaleziona.")

        # Kierowca może pobrać CMR tylko dla swoich tras
        if current_user.role == UserRole.KIEROWCA and route.driver_id != current_user.id:
            raise HTTPException(status_code=403, detail="Brak dostępu do tej trasy.")

        # Pobierz dane kierowcy (do numeru rejestracyjnego)
        driver = session.get(User, route.driver_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Nie znaleziono kierowcy przypisanego do trasy.")

    # Budujemy ParsedDocument ze znanych danych trasy
    doc = ParsedDocument(
        sender_name="SmartLoad AI Sp. z o.o.",
        sender_address="ul. Logistyczna 1, 00-001 Warszawa",
        receiver_name="Odbiorca",
        receiver_address=route.unloading_city,
        cargo_description=f"Ładunek — zlecenie #{route_id}",
        weight_kg=route.weight_kg,
        origin=route.loading_city,
        destination=route.unloading_city,
        vehicle_plate=driver.vehicle_plate or "—",
        price=route.price,
        currency="EUR",
        document_type="CMR",
    )

    try:
        pdf_path = generate_cmr_pdf(doc)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Wczytaj wygenerowany plik do pamięci i odeślij jako streaming
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    filename = f"CMR_{route_id}_{route.loading_city}-{route.unloading_city}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
