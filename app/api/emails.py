from app.services.ai_triage import extract_data_from_full_context
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlmodel import Session, select
from sqlalchemy import func
from bs4 import BeautifulSoup
from pydantic import BaseModel
from app.core.database import engine, get_session
from app.core.security import get_current_user
from app.models.email_log import EmailLog
from app.models.user import User
from app.models.custom_category import CustomCategory
from app.services.ai_triage import categorize_email_with_gemma
import time

router = APIRouter(prefix="/api", tags=["emails"])


class CategoryUpdate(BaseModel):
    category: str


class CustomCategoryCreate(BaseModel):
    name: str


class RescanRequest(BaseModel):
    pass


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


@router.get("/custom-categories")
def get_custom_categories():
    with Session(engine) as session:
        categories = session.exec(select(CustomCategory)).all()
        return [cat.name for cat in categories]


@router.post("/custom-categories")
def create_custom_category(payload: CustomCategoryCreate):
    with Session(engine) as session:
        existing = session.exec(
            select(CustomCategory).where(CustomCategory.name == payload.name)
        ).first()
        if not existing:
            new_cat = CustomCategory(name=payload.name)
            session.add(new_cat)
            session.commit()
        return {"status": "success", "name": payload.name}


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


def process_rescan():
    with Session(engine) as session:
        inne_emails = session.exec(
            select(EmailLog).where(
                (EmailLog.ai_category == "INNE") | (EmailLog.ai_category == None),
                EmailLog.is_deleted == False,
            )
        ).all()
        
        custom_categories = session.exec(select(CustomCategory)).all()
        custom_categories_names = [cat.name for cat in custom_categories]
        
        updated_count = 0
        scanned_count = len(inne_emails)

        for email in inne_emails:
            clean_text = (
                BeautifulSoup(email.body, "html.parser").get_text(separator=" ", strip=True)
                if email.body else ""
            )
            
            # 1. Kategoryzujemy maila (tak jak wcześniej)
            new_cat = categorize_email_with_gemma(
                email.subject, clean_text, custom_categories_names
            )
            
            if new_cat != email.ai_category:
                email.ai_category = new_cat
                
                # --- 🔥 NOWOŚĆ: PEŁNA EKSTRAKCJA DANYCH 🔥 ---
                # Jeśli po ponownym skanowaniu to faktycznie ładunek, wyciągamy z niego wszystko!
                if new_cat in ["OFERTA", "ZAMOWIENIE"]:
                    extracted_data = extract_data_from_full_context(clean_text)
                    
                    if extracted_data:
                        email.loading_city = extracted_data.get("loading_city") or email.loading_city
                        email.loading_zip = extracted_data.get("loading_zip") or email.loading_zip
                        email.unloading_city = extracted_data.get("unloading_city") or email.unloading_city
                        email.unloading_zip = extracted_data.get("unloading_zip") or email.unloading_zip
                        email.weight_kg = extracted_data.get("weight_kg") or email.weight_kg
                        email.price = extracted_data.get("price") or email.price
                        email.currency = extracted_data.get("currency") or email.currency
                # ---------------------------------------------
                
                session.add(email)
                updated_count += 1
                
        if updated_count > 0:
            session.commit() 
            print(f"Zaktualizowano {updated_count} maili (kategorie + dane z ładunków!).")

        return scanned_count, updated_count

@router.post("/emails/rescan")
def rescan_emails(payload: RescanRequest):
    scanned_count, updated_count = process_rescan()
    return {
        "message": "Skanowanie zakończone",
        "scanned": scanned_count,
        "updated": updated_count
    }
