import os
import requests
import random
from datetime import datetime, timedelta
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

# --- 🔐 ŁADOWANIE ZMIENNYCH Z .ENV ---
load_dotenv() # To magicznie zaczytuje plik .env

TIMO_USER = os.getenv("TIMOCOM_USER")
TIMO_PASSWORD = os.getenv("TIMOCOM_PASSWORD")
TIMO_ID = os.getenv("TIMOCOM_ID")

BASE_URL = "https://sandbox.timocom.com/freight-exchange/3"

# --- 🗺️ ZŁOTE TRASY DLA DEMO (Polski Rynek + Sąsiedzi) ---
MARKET_ROUTES = [
    {"from": ("PL", "Warszawa", "00-001"), "to": ("PL", "Poznań", "60-001"), "base_price": 350},
    {"from": ("PL", "Gdańsk", "80-000"), "to": ("PL", "Kraków", "30-001"), "base_price": 550},
    {"from": ("PL", "Wrocław", "50-001"), "to": ("PL", "Katowice", "40-001"), "base_price": 280},
    {"from": ("PL", "Warszawa", "00-001"), "to": ("DE", "Berlin", "10115"), "base_price": 450},
    {"from": ("DE", "Berlin", "10115"), "to": ("PL", "Poznań", "60-001"), "base_price": 400},
    {"from": ("PL", "Katowice", "40-001"), "to": ("CZ", "Praga", "11000"), "base_price": 300},
]

BODY_TYPES = ["CURTAIN_SIDER", "BOX", "THERMO"]

def generate_cluster_for_route(route, num_offers=5):
    """Generuje grupę podobnych ładunków dla danej trasy."""
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
                "languages": ["pl", "en"]
            },
            "trackable": True,
            "vehicleProperties": {
                "body": [random.choice(BODY_TYPES)],
                "type": ["TRAILER"]
            },
            "acceptQuotes": True,
            "freightDescription": "Ładunek testowy - SmartLoad AI",
            "length_m": 13.6 if weight > 15 else round(random.uniform(3.0, 10.0), 1),
            "weight_t": weight,
            "price": {
                "amount": final_price,
                "currency": "EUR"
            },
            "loadingPlaces": [
                {
                    "loadingType": "LOADING",
                    "address": {"objectType": "address", "city": origin[1], "country": origin[0], "postalCode": origin[2]},
                    "earliestLoadingDate": date_str,
                    "latestLoadingDate": date_str
                },
                {
                    "loadingType": "UNLOADING",
                    "address": {"objectType": "address", "city": dest[1], "country": dest[0], "postalCode": dest[2]},
                    "earliestLoadingDate": date_str,
                    "latestLoadingDate": date_str
                }
            ]
        }
        payloads.append(payload)
    return payloads

def seed():
    endpoint = f"{BASE_URL}/my-freight-offers"
    auth = HTTPBasicAuth(TIMO_USER, TIMO_PASSWORD)
    
    query_params = {
        "timocom_id": TIMO_ID
    }
    
    # 🚨 TO JEST KLUCZOWE: Pełne nagłówki HTTP
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "SmartLoad-AI/1.0 (PostmanRuntime/7.28.4)" # Udajemy Postmana/Aplikację
    }
    
    print("🚀 Uruchamiam SmartLoad Market Maker (Tryb Strict)...\n")
    
    total_success = 0
    offers_per_route = 4 
    
    for route in MARKET_ROUTES:
        print(f"📦 Tworzenie rynku dla trasy: {route['from'][1]} -> {route['to'][1]}")
        cluster = generate_cluster_for_route(route, num_offers=offers_per_route)
        
        for idx, offer in enumerate(cluster):
            # Dodajemy ID klienta do payloadu zapobiegawczo
            offer["customer"] = {"id": int(TIMO_ID)} 
            
            price = offer['price']['amount']
            weight = offer['weight_t']
            
            # 🚨 Przekazujemy headers=headers do zapytania!
            response = requests.post(endpoint, json=offer, headers=headers, auth=auth, params=query_params)
            
            if response.status_code == 201:
                offer_id = response.json().get("payload", {}).get("id", "BRAK_ID")
                print(f"   ✅ [Oferta {idx+1}] Sukces! Waga: {weight}t | Cena: {price} EUR | ID: {offer_id}")
                total_success += 1
            else:
                print(f"   ❌ BŁĄD przy ofercie {idx+1} (Kod: {response.status_code})")
                try:
                    error_json = response.json()
                    print(f"      Szczegóły: {error_json.get('title', 'Brak tytułu')}")
                    for invalid_param in error_json.get('invalid-params', []):
                        print(f"      ---> Pole: '{invalid_param.get('name')}' | Powód: {invalid_param.get('reason')}")
                except Exception:
                    print(f"      Surowa odpowiedź: {response.text}")
                    # Jeśli nadal jest pusto, drukujemy JSON-a, żebyś mógł go wkleić do Postmana
                    import json
                    print(f"      Twój JSON: {json.dumps(offer)}")
                    break # Przerywamy klaster po pierwszym błędzie, żeby nie spamować konsoli
        print("-" * 50)

    print(f"\n🎉 Koniec! Wrzucono {total_success} ładunków.")

if __name__ == "__main__":
    if not TIMO_USER or not TIMO_PASSWORD or not TIMO_ID:
        print("❌ Błąd: Brak danych logowania. Upewnij się, że masz plik .env z TIMOCOM_USER, TIMOCOM_PASSWORD i TIMOCOM_ID")
    else:
        seed()