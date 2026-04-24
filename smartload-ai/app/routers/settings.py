# routers/settings.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import imaplib
from database import get_db
from models import ImapSettings  # nowy model poniżej

router = APIRouter(prefix="/api/settings", tags=["settings"])

class ImapSettingsSchema(BaseModel):
    email_user: str
    email_password: str
    email_imap_server: str
    email_imap_port: int = 993

@router.get("/imap")
def get_imap_settings(db: Session = Depends(get_db)):
    row = db.query(ImapSettings).first()
    if not row:
        # fallback do .env
        import os
        return {
            "email_user":        os.getenv("EMAIL_USER", ""),
            "email_password":    "",  # nie zwracamy hasła z .env
            "email_imap_server": os.getenv("EMAIL_IMAP_SERVER", "imap.gmail.com"),
            "email_imap_port":   int(os.getenv("EMAIL_IMAP_PORT", "993")),
        }
    return {
        "email_user":        row.email_user,
        "email_password":    row.email_password,
        "email_imap_server": row.email_imap_server,
        "email_imap_port":   row.email_imap_port,
    }

@router.post("/imap")
def save_imap_settings(payload: ImapSettingsSchema, db: Session = Depends(get_db)):
    row = db.query(ImapSettings).first()
    if row:
        row.email_user        = payload.email_user
        row.email_password    = payload.email_password
        row.email_imap_server = payload.email_imap_server
        row.email_imap_port   = payload.email_imap_port
    else:
        row = ImapSettings(**payload.dict())
        db.add(row)
    db.commit()
    return {"ok": True}

@router.post("/imap/test")
def test_imap(payload: ImapSettingsSchema):
    try:
        mail = imaplib.IMAP4_SSL(payload.email_imap_server, payload.email_imap_port)
        mail.login(payload.email_user, payload.email_password)
        mail.select("INBOX")
        _, data = mail.search(None, "ALL")
        count = len(data[0].split()) if data[0] else 0
        mail.logout()
        return {"ok": True, "message_count": count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))