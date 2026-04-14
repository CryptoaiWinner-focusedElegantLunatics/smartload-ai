import re
from typing import Optional
from imap_tools import MailBox
from bs4 import BeautifulSoup
from app.core.config import settings

def fetch_latest_offers(limit: Optional[int] = 50):
    if not settings.EMAIL_USER or not settings.EMAIL_PASSWORD:
        return {"error": "Brak danych logowania do poczty w pliku .env!"}

    try:
        with MailBox(settings.EMAIL_IMAP_SERVER).login(settings.EMAIL_USER, settings.EMAIL_PASSWORD) as mailbox:
            
            try:
                mailbox.folder.set('[Gmail]/Wszystkie')
            except Exception:
                try:
                    mailbox.folder.set('[Gmail]/All Mail')
                except Exception:
                    pass

            messages = mailbox.fetch(limit=limit, reverse=True)
            fetched_data = []
            
            for msg in messages:
                raw_text = msg.text.strip()
                if not raw_text and msg.html:
                    soup = BeautifulSoup(msg.html, "html.parser")
                    raw_text = soup.get_text(separator=" ", strip=True)                
                clean_text = " ".join(raw_text.split())
                body_preview = clean_text if clean_text else "Brak treści"
                
                offer = {
                    "uid": msg.uid,
                    "sender": msg.from_,
                    "subject": msg.subject,
                    "date": msg.date.strftime("%Y-%m-%d %H:%M"),
                    "has_attachments": len(msg.attachments) > 0,
                    "text": body_preview
                }
                fetched_data.append(offer)

            return {
                "status": "success",
                "count": len(fetched_data),
                "offers": fetched_data
            }

    except Exception as e:
        return {"error": f"Błąd połączenia z pocztą: {str(e)}"}