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
    from app.seeds.seed_db import seed_test_emails
    seed_test_emails()
    return {"status": "Data seeded successfully."}


@router.post("/seed-loads")
def seed_loads():
    from app.seeds.seed import seed_db
    seed_db()
    return {"status": "Base loads seeded successfully."}


@router.post("/seed-advanced")
def seed_advanced(count_emails: int = 100, count_loads: int = 50):
    from app.seeds.advanced_seeder import seed_everything
    seed_everything(count_emails=count_emails, count_timo=count_loads)
    return {"status": "Advanced seed completed.", "emails": count_emails, "loads": count_loads}


@router.post("/seed-timocom")
def seed_timocom():
    from app.seeds.timocom_seeder import seed
    return seed()


@router.get("/create-superuser")
def create_superuser():
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
