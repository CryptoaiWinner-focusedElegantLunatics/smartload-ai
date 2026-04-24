import requests

try:
    resp = requests.post("http://localhost:8000/api/emails/rescan", json={"custom_categories":["REKLAMACJA"]})
    print("Status:", resp.status_code)
    print("Body:", resp.text)
except Exception as e:
    print("Error:", e)
