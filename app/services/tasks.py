import logging
import time
from typing import Optional
from sqlmodel import Session, select
from app.core.celery_app import celery_app
from app.services.email_fetcher import fetch_latest_offers
from app.core.database import engine
from app.models.email_log import EmailLog
from app.services.ai_triage import categorize_email_with_gemma

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

@celery_app.task(bind=True, max_retries=3)
def process_emails_task(self, limit: Optional[int] = 50):
    try:
        logger.info(f"🚀 POBIERAM MAILE (Max: {limit})...")
        result = fetch_latest_offers(limit=limit)
        offers = result.get("offers", [])
        
        if not offers:
            logger.info("📭 Brak nowych maili.")
            return {"status": "success", "processed": 0}

        new_emails_count = 0

        with Session(engine) as session:
            for i, offer in enumerate(offers, 1):
                existing_email = session.exec(select(EmailLog).where(EmailLog.uid == offer['uid'])).first()
                
                if existing_email:
                    continue
                
                new_emails_count += 1
                category = categorize_email_with_gemma(offer['subject'], offer['text'])
                db_email = EmailLog(
                    uid=offer['uid'],
                    sender=offer['sender'],
                    subject=offer['subject'],
                    body=offer['text'],
                    ai_category=category
                )
                session.add(db_email)
                session.commit()
                time.sleep(0.5)
                
                attachment_status = "✅ Posiada" if offer.get('has_attachments') else "❌ Brak"
                log_block = (
                    f"\n{'━' * 60}\n"
                    f"\n📩 WIADOMOŚĆ {i}/{len(offers)} | 🤖 Kategoria AI: [{category}]\n"
                    f"\n{'━' * 60}\n"
                    f"\n👤 Od:    {offer['sender']}\n"
                    f"\n📌 Temat: {offer['subject']}\n"
                    f"\n📅 Data:  {offer['date']}\n"
                    f"\n📎 Zał:   {attachment_status}\n"
                    f"\n📝 TREŚĆ (podgląd):\n"
                    f"\n   > {offer['text'][:200]}...\n"
                )
                logger.info(log_block)

        if new_emails_count == 0:
            logger.info("✅ Wszystkie pobrane maile były już w bazie (0 nowych).")
        else:
            logger.info(f"🎉 SUKCES! Przeanalizowano i zapisano {new_emails_count} nowych maili.")

        return {"status": "success", "processed": new_emails_count}
        
    except Exception as exc:
        logger.error(f"❌ Błąd procesu: {exc}")
        self.retry(exc=exc, countdown=10)