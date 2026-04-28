import os
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.core.database import engine, get_session
from app.core.security import RoleChecker
from app.models.load import Load
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = RoleChecker(["ADMIN"])


@router.get("/db-check")
def check_db(session: Session = Depends(get_session), user: User = Depends(_admin_only)):
    loads_list = session.exec(select(Load)).all()
    return {"status": "success", "loads_count": len(loads_list)}


@router.get("/seed-data")
def seed_data(user: User = Depends(_admin_only)):
    from app.seeds.seed_db import seed_test_emails
    seed_test_emails()
    return {"status": "Data seeded successfully."}


@router.post("/seed-timocom")
def seed_timocom(user: User = Depends(_admin_only)):
    from app.seeds.timocom_seeder import seed
    return seed()


@router.get("/create-superuser")
def create_superuser(user: User = Depends(_admin_only)):
    url = os.getenv("DATABASE_URL")
    print(f"DEBUG: DATABASE_URL = {url}")

    if not url:
        return {"error": "DATABASE_URL is not set in the environment."}

    try:
        from app.seeds.seed_admin import create_superuser
        create_superuser()
        return {"status": "Superuser created successfully."}
    except Exception as e:
        return {"error": str(e), "database_url": url}

@router.get("/seed-all")
def seed_all(user: User = Depends(_admin_only)):
    from app.seeds.advanced_seeder import seed_everything
    seed_everything()
    return {"status": "Data seeded successfully."}


@router.get("/seed-roles")
def seed_roles_endpoint(user: User = Depends(_admin_only)):
    from app.seeds.seed_roles import seed_roles
    seed_roles()
    return {"status": "Role accounts seeded successfully."}