
import os
import sys
sys.path.append('.')
from sqlmodel import Session, select
from app.core.database import engine
from app.models.email_log import EmailLog

with Session(engine) as session:
    e = EmailLog(
        uid="12345test",
        sender="test@test.com",
        subject="Szukam wywrotki",
        body="<p>Szukam wywrotki 24 tony piachu z Gdyni do Sopotu, na wczoraj.</p>",
        ai_category="INNE"
    )
    session.add(e)
    session.commit()
