import logging
import time
from typing import Optional
from sqlmodel import Session, select
from app.core.celery_app import celery_app
from app.services.email_fetcher import fetch_latest_offers
from app.core.database import engine
from app.models.email_log import EmailLog
from app.services.ai_triage import categorize_email_with_gemma, extract_data_from_full_context

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

@celery_app.task(bind=True, max_retries=3)
def process_emails_task(self, limit: Optional[int] = 50):
    try:
        with Session(engine) as session:
            # Szybko wyciągamy UIDs obecnych wiadomości by uniknąć pobierania ciał
            db_uids = session.exec(select(EmailLog.uid).order_by(EmailLog.id.desc()).limit(1500)).all()
            existing_uids = set(db_uids)
            
        logger.info(f"🚀 POBIERAM MAILE w tle (Limit: {limit})...")
        result = fetch_latest_offers(limit=limit, existing_uids=existing_uids)
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

                extracted_data = {}
                if category in ["OFERTA", "ZAMOWIENIE", "DOKUMENT_CMR"]:
                    # ── Krok 1: Fuzja maila + OCR PDF → jeden kontekst ──────────────
                    combined_body = f"=== TREŚĆ MAILA ===\n{offer['text']}\n"

                    pdf_attachments = offer.get("pdf_attachments", [])
                    if pdf_attachments:
                        from app.services.ocr_service import extract_text_from_pdf
                        for pdf in pdf_attachments:
                            try:
                                logger.info(f"📄 Pobrano PDF: {pdf['filename']} — uruchamiam OCR...")
                                pdf_text = extract_text_from_pdf(pdf["content"])
                                if pdf_text:
                                    combined_body += f"\n=== ZAŁĄCZNIK PDF: {pdf['filename']} ===\n{pdf_text}\n"
                                    logger.info(f"✅ OCR ukończony: {pdf['filename']} ({len(pdf_text)} znaków)")
                                else:
                                    logger.warning(f"⚠️ OCR nie zwrócił tekstu dla: {pdf['filename']}")
                            except Exception as e:
                                logger.error(f"❌ Błąd OCR dla {pdf['filename']}: {e}")
                                # Kontynuujemy — uszkodzony PDF nie przerywa pętli

                    # ── Krok 2: Ekstrakcja danych z połączonego kontekstu ────────────
                    logger.info(f"🔍 Ekstrakcja danych z pełnego kontekstu ({len(combined_body)} znaków): {offer['subject']}")
                    extracted_data = extract_data_from_full_context(combined_body)
                    logger.info(f"📦 Dane wyekstrahowane: {extracted_data}")
                    time.sleep(2)  # Hamulec na API

                db_email = EmailLog(
                    uid=offer['uid'],
                    sender=offer['sender'],
                    subject=offer['subject'],
                    body=offer['html_body'],
                    ai_category=category,
                    loading_city=extracted_data.get('loading_city'),
                    loading_zip=extracted_data.get('loading_zip'),
                    unloading_city=extracted_data.get('unloading_city'),
                    unloading_zip=extracted_data.get('unloading_zip'),
                    weight_kg=extracted_data.get('weight_kg'),
                    price=extracted_data.get('price'),
                    currency=extracted_data.get('currency'),
                )
                session.add(db_email)
                session.commit()
                time.sleep(3)
                
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