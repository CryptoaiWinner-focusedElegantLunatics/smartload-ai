import re
import base64
from typing import Optional
from imap_tools import MailBox
from bs4 import BeautifulSoup
from app.core.config import settings

def fetch_latest_offers(limit: Optional[int] = 50, existing_uids: set = None):
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

            if existing_uids is not None:
                messages_headers = mailbox.fetch(limit=limit, reverse=True, headers_only=True)
                new_uids = [msg.uid for msg in messages_headers if msg.uid not in existing_uids]
                
                if not new_uids:
                    return {"status": "success", "count": 0, "offers": []}
                
                # Używamy surowego polecenia IMAP UID by bezpiecznie wyciągnąć pominęte maile
                uid_str = ",".join(new_uids)
                messages = mailbox.fetch(f"UID {uid_str}")
            else:
                messages = mailbox.fetch(limit=limit, reverse=True)

            fetched_data = []
            
            for msg in messages:
                is_html = bool(msg.html)
                body = msg.html if is_html else msg.text
                
                if msg.text and msg.text.strip():
                    plain_text = msg.text
                elif is_html:
                    plain_text = BeautifulSoup(msg.html, "html.parser").get_text(separator=' ', strip=True)
                else:
                    plain_text = "Brak treści"

                pdf_attachments = []  # Lista słowników: {"filename": str, "content": bytes}

                for att in msg.attachments:
                    # Podmiana obrazów inline (CID)
                    if att.content_id and is_html:
                        cid = att.content_id.strip('<>')
                        try:
                            b64_data = base64.b64encode(att.payload).decode('utf-8')
                            ctype = att.content_type if att.content_type else "image/jpeg"
                            data_uri = f"data:{ctype};base64,{b64_data}"
                            body = body.replace(f"cid:{cid}", data_uri)
                        except Exception as e:
                            print(f"Błąd konwersji obrazka z CID {cid}: {e}")

                    # Zbieramy PDF-y — OCR zostanie uruchomiony w tasks.py
                    if att.filename and att.filename.lower().endswith(".pdf"):
                        pdf_attachments.append({
                            "filename": att.filename,
                            "content": att.payload
                        })
                
                offer = {
                    "uid": msg.uid,
                    "sender": msg.from_,
                    "subject": msg.subject,
                    "date": msg.date.strftime("%Y-%m-%d %H:%M"),
                    "has_attachments": len(msg.attachments) > 0,
                    "text": plain_text,
                    "html_body": body if body else "Brak treści",
                    "pdf_attachments": pdf_attachments,
                }
                fetched_data.append(offer)

            return {
                "status": "success",
                "count": len(fetched_data),
                "offers": fetched_data
            }

    except Exception as e:
        return {"error": f"Błąd połączenia z pocztą: {str(e)}"}