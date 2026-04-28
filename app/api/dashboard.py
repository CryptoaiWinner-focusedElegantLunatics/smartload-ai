from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import engine
from app.core.security import RoleChecker
from app.models.user import User
from app.models.assigned_route import AssignedRoute

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class RecentRoute(BaseModel):
    id: int
    loading_city: str
    unloading_city: str
    weight_kg: float
    price: float
    status: str
    assigned_at: datetime
    assigned_by_email: Optional[str] = None


class DriverStatsResponse(BaseModel):
    stats: dict[str, int]
    recent_routes: list[RecentRoute]
    total: int


@router.get("/driver-stats", response_model=DriverStatsResponse)
def driver_stats(
    current_user: User = Depends(RoleChecker(["KIEROWCA"])),
):
    """Statystyki tras dla zalogowanego kierowcy."""
    with Session(engine) as session:
        all_routes = session.exec(
            select(AssignedRoute)
            .where(AssignedRoute.driver_id == current_user.id)
            .order_by(AssignedRoute.assigned_at.desc())
        ).all()

        # Grupuj po statusie
        stats: dict[str, int] = {"PRZYPISANE": 0, "W DRODZE": 0, "ROZŁADOWANE": 0}
        for r in all_routes:
            if r.status in stats:
                stats[r.status] += 1
            else:
                stats[r.status] = 1

        # 3 najnowsze aktywne trasy
        active = [r for r in all_routes if r.status in ("PRZYPISANE", "W DRODZE")][:3]

        recent = []
        for r in active:
            assigned_by_email = None
            if r.assigned_by_id:
                assigner = session.get(User, r.assigned_by_id)
                if assigner:
                    assigned_by_email = assigner.email or assigner.username
            recent.append(RecentRoute(
                id=r.id,
                loading_city=r.loading_city,
                unloading_city=r.unloading_city,
                weight_kg=r.weight_kg,
                price=r.price,
                status=r.status,
                assigned_at=r.assigned_at,
                assigned_by_email=assigned_by_email,
            ))

    return DriverStatsResponse(
        stats=stats,
        recent_routes=recent,
        total=len(all_routes),
    )
