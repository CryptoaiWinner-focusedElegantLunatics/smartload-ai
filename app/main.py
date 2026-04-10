from typing import Optional
from fastapi import FastAPI, Depends
from sqlmodel import SQLModel, Session, select
from sqlalchemy import text
from app.core.database import engine, get_session
from app.models.load import Load
from app.services.tasks import process_emails_task

app = FastAPI(title="SmartLoad AI API")

@app.on_event("startup")
def on_startup():
    with Session(engine) as session:
        session.exec(text("CREATE EXTENSION IF NOT EXISTS vector"))
        session.commit()
    
    SQLModel.metadata.create_all(engine)

@app.get("/")
def read_root():
    return {"status": "SmartLoad AI is running", "mordeczko": "Logistyka przejęta!"}

@app.get("/db-check")
def check_db(session: Session = Depends(get_session)):
    loads = session.exec(select(Load)).all()
    return {"status": "success", "loads_count": len(loads)}

@app.get("/loads", response_model=list[Load])
def get_loads(session: Session = Depends(get_session), limit: int = 100):
    loads = session.exec(select(Load).limit(limit)).all()


    return loads

@app.post("/sync-emails")
@app.post("/sync-emails")
def trigger_background_sync(limit: Optional[int] = 50):
    """
    Zleca pobranie maili w tle. Możesz podać własny limit, np. ?limit=100
    """
    task = process_emails_task.delay(limit)
    return {
        "status": "processing",
        "task_id": task.id,
        "message": f"Zlecono pobranie {limit} maili w tle."
    }