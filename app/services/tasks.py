import logging
from typing import Optional
from app.core.celery_app import celery_app
from app.services.email_fetcher import fetch_latest_offers

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) 

@celery_app.task(bind=True, max_retries=3)
def process_emails_task(self, limit: Optional[int] = 50):
    try:
        logger.info(f"🚀 ROZPOCZYNAM POBIERANIE MAKSYMALNIE {limit} MAILÓW...")
        result = fetch_latest_offers(limit=limit)
        
        offers = result.get("offers", [])
        count = result.get("count", 0)
        
        if count == 0:
            logger.info("📭 Brak nowych nieprzeczytanych maili do pobrania.")
            return {"status": "success", "processed": 0}

        logger.info(f"✅ SUKCES! POBRANO {count} MAILÓW! OTO ONE:")
        logger.info("=" * 40)
        
        for i, offer in enumerate(offers, 1):
            attachment_status = "✅ Posiada" if offer.get('has_attachments') else "❌ Brak"
            log_block = (
                f"\n{'━' * 60}\n"
                f"📩 WIADOMOŚĆ {i}/{count}\n"
                f"{'━' * 60}\n"
                f"👤 Od:    {offer['sender']}\n"
                f"📌 Temat: {offer['subject']}\n"
                f"📅 Data:  {offer['date']}\n"
                f"📎 Zał:   {attachment_status}\n"
                f"📝 TREŚĆ (podgląd):\n"
                f"   > {offer['text']}\n"
            )
            logger.info(log_block)

        return {"status": "success", "processed": count}
        
    except Exception as exc:
        logger.error(f"❌ Błąd podczas pobierania: {exc}")
        self.retry(exc=exc, countdown=10)