from fastapi import FastAPI
from app.database import engine, Base

app = FastAPI(title="AI Spedition API", version="0.1.0")

Base.metadata.create_all(bind=engine)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AI Spedition backend działa!"}