from typing import Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from sqlalchemy import func
from pydantic import BaseModel
from app.core.database import engine, get_session
from app.core.security import get_current_user
from app.models.email_log import EmailLog
from app.models.user import User
from app.services.ai_triage import categorize_email_with_gemma
import time

router = APIRouter(prefix="/api", tags=["emails"])


class CategoryUpdate(BaseModel):
    category: str


class RescanRequest(BaseModel):
    custom_categories: list[str] = []


class BulkDeleteRequest(BaseModel):
    email_ids: list[int]


@router.get("/stats")
def get_email_stats(user: User = Depends(get_current_user)):
    """Zwraca liczbę maili pogrupowanych po ai_category."""
    with Session(engine) as session:
        rows = session.exec(
            select(EmailLog.ai_category, func.count(EmailLog.id).label("count"))
            .where(EmailLog.is_deleted == False)
            .group_by(EmailLog.ai_category)
        ).all()
        return {row[0] or "INNE": row[1] for row in rows}


@router.get("/emails")
def get_emails(
    limit: int = 100,
    kategoria: Optional[str] = None,
    szukaj: Optional[str] = None,
):
    with Session(engine) as session:
        query = select(EmailLog).where(EmailLog.is_deleted == False)

        if kategoria and kategoria != "WSZYSTKIE":
            query = query.where(EmailLog.ai_category == kategoria)

        if szukaj:
            query = query.where(
                EmailLog.subject.contains(szukaj) | EmailLog.sender.contains(szukaj)
            )

        query = query.order_by(EmailLog.id.desc()).limit(limit)
        return session.exec(query).all()


@router.put("/emails/{email_id}/category")
def update_email_category(email_id: int, payload: CategoryUpdate):
    with Session(engine) as session:
        email = session.get(EmailLog, email_id)
        if not email:
            return {"error": "Nie znaleziono maila"}
        email.ai_category = payload.category.upper()
        session.add(email)
        session.commit()
        return {"status": "success", "new_category": email.ai_category}


@router.put("/emails/{email_id}/archive")
def archive_email(email_id: int):
    return {"status": "success", "message": "Mail zarchiwizowany (Funkcja w budowie)"}


@router.delete("/emails/{email_id}")
def delete_single_email(email_id: int):
    with Session(engine) as session:
        email = session.get(EmailLog, email_id)
        if not email:
            return {"error": "Nie znaleziono maila"}
        session.delete(email)
        session.commit()
        return {"status": "success"}


@router.post("/emails/bulk-delete")
def bulk_delete_emails(payload: BulkDeleteRequest):
    with Session(engine) as session:
        deleted_count = 0
        for eid in payload.email_ids:
            email = session.get(EmailLog, eid)
            if email:
                session.delete(email)
                deleted_count += 1
        session.commit()
        return {"status": "success", "deleted": deleted_count}


@router.post("/emails/rescan")
def rescan_emails(payload: RescanRequest):
    with Session(engine) as session:
        inne_emails = session.exec(
            select(EmailLog).where(
                (EmailLog.ai_category == "INNE") | (EmailLog.ai_category == None),
                EmailLog.is_deleted == False,
            )
        ).all()
        updated_count = 0

        from bs4 import BeautifulSoup
        for email in inne_emails:
            clean_text = (
                BeautifulSoup(email.body, "html.parser").get_text(separator=" ", strip=True)
                if email.body else ""
            )
            new_cat = categorize_email_with_gemma(
                email.subject, clean_text, payload.custom_categories
            )
            if new_cat != email.ai_category:
                email.ai_category = new_cat
                session.add(email)
                updated_count += 1

        session.commit()
        return {"status": "success", "scanned": len(inne_emails), "updated": updated_count}
