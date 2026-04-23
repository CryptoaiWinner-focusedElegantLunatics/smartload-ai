import requests

# Zarejestruj testowy e-mail jako INNE do bazy
db_insert_script = """
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
"""
with open("add_test_email.py", "w") as f:
    f.write(db_insert_script)

import subprocess
subprocess.run(["python", "add_test_email.py"])

try:
    resp = requests.post("http://localhost:8000/api/emails/rescan", json={"custom_categories":["WYWROTKA", "REKLAMACJA"]})
    print("Status:", resp.status_code)
    print("Body:", resp.text)
except Exception as e:
    print("Error:", e)
