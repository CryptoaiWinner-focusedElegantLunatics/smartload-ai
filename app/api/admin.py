import os
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.core.database import engine, get_session
from app.models.load import Load

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/db-check")
def check_db(session: Session = Depends(get_session)):
    loads_list = session.exec(select(Load)).all()
    return {"status": "success", "loads_count": len(loads_list)}


@router.get("/seed-data")
def seed_data():
    from seed_db import seed_test_emails
    seed_test_emails()
    return {"status": "Data seeded successfully."}


@router.get("/create-superuser")
def create_superuser():
    url = os.getenv("DATABASE_URL")
    print(f"DEBUG: DATABASE_URL = {url}")

    if not url:
        return {"error": "DATABASE_URL is not set in the environment."}

    try:
        from seed_admin import create_superuser
        create_superuser()
        return {"status": "Superuser created successfully."}
    except Exception as e:
        return {"error": str(e), "database_url": url}
