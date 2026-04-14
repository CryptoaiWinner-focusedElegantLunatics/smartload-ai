import os
import time
import requests
import logging
import json
from app.core.config import settings

logger = logging.getLogger(__name__)

def categorize_email_with_gemma(subject: str, body: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    
    if not api_key:
        logger.error("❌ Brak klucza OPENROUTER_API_KEY w pliku .env!")
        return "INNE"

    prompt = f"""
    Przeczytaj poniższy e-mail i przypisz go do JEDNEJ z poniższych kategorii:
    OFERTA - jeśli ktoś szuka auta, pyta o stawkę lub oferuje ładunek.
    ZAMOWIENIE - jeśli to oficjalne zlecenie transportowe do realizacji.
    FAKTURA - jeśli to dokument księgowy lub rozliczenie.
    DOKUMENT_CMR - jeśli to skan listu przewozowego.
    INNE - jeśli to spam, powiadomienie z systemu, newsletter.
    
    Temat: {subject}
    Treść: {body}
    """
    
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "google/gemma-2-27b-it", 
                    "messages": [
                        {
                            "role": "system", 
                            "content": "Jesteś wybitnym asystentem AI w firmie spedycyjnej. Odpowiadasz ZAWSZE i TYLKO JEDNYM SŁOWEM z listy."
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    "temperature": 0.0,
                    "max_tokens": 50
                }
            )
            
            if response.status_code == 429:
                logger.warning(f"⚠️ Serwer AI przeciążony. Czekam 3s i próbuję ponownie ({attempt + 1}/{max_retries})...")
                time.sleep(3)
                continue
                
            if response.status_code == 200:
                data = response.json()
                usage = data.get("usage")
                if usage:
                    t_in = usage.get("prompt_tokens", 0)
                    t_out = usage.get("completion_tokens", 0)
                    print(f"\n💰 [TOKENY] Wejście: {t_in} | Wyjście: {t_out} | Łącznie: {t_in + t_out}")
                else:
                    print("\n💰 [TOKENY] OpenRouter nie zwrócił statystyk dla tego zapytania.")
            
                result = data["choices"][0]["message"]["content"].strip().upper()
                
                valid_categories = ["OFERTA", "ZAMOWIENIE", "FAKTURA", "DOKUMENT_CMR", "INNE"]
                for cat in valid_categories:
                    if cat in result:
                        return cat
                return "INNE"
            else:
                logger.error(f"❌ Błąd API OpenRouter: {response.text}")
                return "INNE"
                
        except Exception as e:
            logger.error(f"❌ Brak połączenia z OpenRouter na próbie {attempt + 1}: {e}")
            time.sleep(3) 
            
    logger.error("❌ Poddaję się. Zbyt wiele błędów API.")
    return "INNE"