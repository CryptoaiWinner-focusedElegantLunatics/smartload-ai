import os
import requests
import random
from datetime import datetime, timedelta
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

TIMO_USER = os.getenv("TIMOCOM_USER")
TIMO_PASSWORD = os.getenv("TIMOCOM_PASSWORD")
TIMO_ID = os.getenv("TIMOCOM_ID")

BASE_URL = "https://sandbox.timocom.com/freight-exchange/3"

MARKET_ROUTES = [
    {"from": ("PL", "Warszawa", "00-001"), "to": ("PL", "Poznań", "60-001"), "base_price": 350},
    {"from": ("PL", "Gdańsk", "80-000"), "to": ("PL", "Kraków", "30-001"), "base_price": 550},
    {"from": ("PL", "Wrocław", "50-001"), "to": ("PL", "Katowice", "40-001"), "base_price": 280},
    {"from": ("PL", "Warszawa", "00-001"), "to": ("DE", "Berlin", "10115"), "base_price": 450},
    {"from": ("DE", "Berlin", "10115"), "to": ("PL", "Poznań", "60-001"), "base_price": 400},
    {"from": ("PL", "Katowice", "40-001"), "to": ("CZ", "Prague", "11000"), "base_price": 300},
]

BODY_TYPES = ["CURTAIN_SIDER", "BOX", "THERMO"]


def generate_cluster_for_route(route, num_offers=5):
    """Generates a cluster of similar freight offers for a given route."""
    payloads = []
    origin = route["from"]
    dest = route["to"]
    base_price = route["base_price"]

    for _ in range(num_offers):
        price_variation = random.uniform(0.85, 1.15)
        final_price = round(base_price * price_variation, 0)
        weight = round(random.uniform(5.0, 24.0), 1)

        start_date_obj = datetime.now() + timedelta(days=random.randint(1, 3))
        date_str = start_date_obj.strftime("%Y-%m-%d")

        payload = {
            "objectType": "freightOffer",
            "contactPerson": {
                "email": "spedytor@smartload.pl",
                "firstName": "Antoni",
                "lastName": "Kocjan",
                "title": "MR",
                "languages": ["pl", "en"],
            },
            "trackable": True,
            "vehicleProperties": {
                "body": [random.choice(BODY_TYPES)],
                "type": ["TRAILER"],
            },
            "acceptQuotes": True,
            "freightDescription": "Test freight - SmartLoad AI",
            "length_m": 13.6 if weight > 15 else round(random.uniform(3.0, 10.0), 1),
            "weight_t": weight,
            "price": {"amount": final_price, "currency": "EUR"},
            "loadingPlaces": [
                {
                    "loadingType": "LOADING",
                    "address": {
                        "objectType": "address",
                        "city": origin[1],
                        "country": origin[0],
                        "postalCode": origin[2],
                    },
                    "earliestLoadingDate": date_str,
                    "latestLoadingDate": date_str,
                },
                {
                    "loadingType": "UNLOADING",
                    "address": {
                        "objectType": "address",
                        "city": dest[1],
                        "country": dest[0],
                        "postalCode": dest[2],
                    },
                    "earliestLoadingDate": date_str,
                    "latestLoadingDate": date_str,
                },
            ],
        }
        payloads.append(payload)
    return payloads


def seed() -> dict:
    """
    Posts test freight offers to the Timocom sandbox API.
    Returns a summary dict suitable for use as an API response.
    """
    if not TIMO_USER or not TIMO_PASSWORD or not TIMO_ID:
        return {"error": "Missing Timocom credentials. Set TIMOCOM_USER, TIMOCOM_PASSWORD and TIMOCOM_ID in .env"}

    endpoint = f"{BASE_URL}/my-freight-offers"
    auth = HTTPBasicAuth(TIMO_USER, TIMO_PASSWORD)
    query_params = {"timocom_id": TIMO_ID}
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SmartLoad-AI/1.0 (PostmanRuntime/7.28.4)",
    }

    total_success = 0
    total_failed = 0
    offers_per_route = 4
    results = []

    for route in MARKET_ROUTES:
        route_label = f"{route['from'][1]} -> {route['to'][1]}"
        cluster = generate_cluster_for_route(route, num_offers=offers_per_route)

        for idx, offer in enumerate(cluster):
            offer["customer"] = {"id": int(TIMO_ID)}
            response = requests.post(
                endpoint, json=offer, headers=headers, auth=auth, params=query_params
            )

            if response.status_code == 201:
                offer_id = response.json().get("payload", {}).get("id", "N/A")
                results.append({
                    "route": route_label,
                    "offer": idx + 1,
                    "status": "ok",
                    "offer_id": offer_id,
                    "weight_t": offer["weight_t"],
                    "price_eur": offer["price"]["amount"],
                })
                total_success += 1
            else:
                error_detail = {}
                try:
                    error_detail = response.json()
                except Exception:
                    error_detail = {"raw": response.text}
                results.append({
                    "route": route_label,
                    "offer": idx + 1,
                    "status": "error",
                    "http_code": response.status_code,
                    "detail": error_detail,
                })
                total_failed += 1

    return {
        "status": "done",
        "total_success": total_success,
        "total_failed": total_failed,
        "results": results,
    }


if __name__ == "__main__":
    import json
    print(json.dumps(seed(), indent=2))
