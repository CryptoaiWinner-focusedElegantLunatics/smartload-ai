from fastapi import FastAPI, Depends
from sqlmodel import SQLModel, Session, select
from sqlalchemy import text
from app.core.database import engine, get_session
from app.models.load import Load

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

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AI Spedition backend działa!"}

@app.get("/db-check")
def check_db(session: Session = Depends(get_session)):
    loads = session.exec(select(Load)).all()
    return {"status": "Baza podłączona pomyślnie!", "loads_count": len(loads)}
