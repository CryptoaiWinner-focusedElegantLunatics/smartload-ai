from app.services.email_fetcher import fetch_latest_offers
from app.core.database import engine
from sqlmodel import Session, select
from app.models.email_log import EmailLog

with Session(engine) as session:
    db_uids = session.exec(select(EmailLog.uid)).all()
    existing_uids = set(db_uids)
    existing_uids.discard('10292')

res = fetch_latest_offers(limit=1000, existing_uids=existing_uids)
for o in res.get('offers', []):
    if o['uid'] == '10292':
        print(f"HTML length: {len(o['html_body'])}")
        print(o['html_body'][:200])
