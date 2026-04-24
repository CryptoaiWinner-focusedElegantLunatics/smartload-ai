import re
import os
import time
import requests
import logging
import json
from app.core.config import settings

logger = logging.getLogger(__name__)

def categorize_email_with_gemma(subject: str, body: str, custom_categories: list[str] = None) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    
    if not api_key:
        logger.error("❌ Brak klucza OPENROUTER_API_KEY w pliku .env!")
        return "INNE"

    categories_text = """
    OFERTA - jeśli ktoś szuka auta, pyta o stawkę lub oferuje ładunek.
    ZAMOWIENIE - jeśli to oficjalne zlecenie transportowe do realizacji.
    FAKTURA - jeśli to dokument księgowy lub rozliczenie.
    DOKUMENT_CMR - jeśli to skan listu przewozowego."""
    
    valid_categories = ["OFERTA", "ZAMOWIENIE", "FAKTURA", "DOKUMENT_CMR"]
    if custom_categories:
        valid_categories.extend(custom_categories)
        for cat in custom_categories:
            categories_text += f"\n    {cat} - kategoria zdefiniowana przez użytkownika."

    valid_categories.append("INNE")
    categories_text += "\n    INNE - jeśli to spam, powiadomienie z systemu, newsletter, lub gdy nie pasuje do żadnej z powyższych."

    prompt = f"""
    Przeczytaj poniższy e-mail i przypisz go do JEDNEJ z poniższych kategorii:
    {categories_text}
    
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
                    "model": "google/gemma-4-26b-a4b-it", 
                    "provider": {
                        "order": ["Together", "Fireworks", "DeepInfra"]
                    },
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
            
            if response.status_code == 200:
                data = response.json()
                
                if "error" in data:
                    error = data['error']
                    # Provider-level rate limit (zwracany jako HTTP 200 z błędem w body)
                    if isinstance(error, dict) and error.get('code') == 429:
                        wait = 10 * (attempt + 1) 
                        logger.warning(f"⚠️ Provider AI przeciążony (429 w body). Czekam {wait}s... Próba {attempt + 1}/{max_retries}")
                        time.sleep(wait)
                    else:
                        logger.warning(f"⚠️ OpenRouter zwrócił błąd w obiekcie JSON: {error}. Próba {attempt + 1}/{max_retries}")
                        time.sleep(5)
                    continue

                if "choices" not in data or not data["choices"]:
                    logger.warning(f"⚠️ Odpowiedź OpenRouter nie zawiera 'choices': {data}. Próba {attempt + 1}/{max_retries}")
                    time.sleep(3)
                    continue
            
                result = data["choices"][0]["message"]["content"].strip().upper()
                
                for cat in valid_categories:
                    if cat in result:
                        return cat
                return "INNE"
            elif response.status_code == 429:
                logger.warning(f"⚠️ Serwer AI przeciążony (429). Czekam 3s i próbuję ponownie ({attempt + 1}/{max_retries})...")
                time.sleep(3)
                continue
            else:
                logger.warning(f"⚠️ Błąd API OpenRouter (HTTP {response.status_code}): {response.text}. Próba {attempt + 1}/{max_retries}")
                time.sleep(3)
                continue
                
        except Exception as e:
            logger.error(f"❌ Wystąpił wyjątek podczas połączenia na próbie {attempt + 1}: {e}")
            time.sleep(3) 
            
    logger.error("❌ Poddaję się. Zbyt wiele błędów API OpenRouter.")
    return "INNE"


def extract_data_from_full_context(text: str) -> dict:
    """
    Zunifikowany Rurociąg Ekstrakcji: analizuje połączony kontekst
    (treść maila + OCR z PDF) i zwraca strukturalne dane ładunku jako dict.
    Dane z PDF mają priorytet nad treścią maila.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("❌ Brak klucza OPENROUTER_API_KEY do ekstrakcji!")
        return {}

    # Limit tokenów — bierzemy pierwsze 4000 znaków połączonego kontekstu
    capped_text = text[:4000]

    prompt = f"""Jesteś Senior Analitykiem Danych w firmie spedycyjnej.
Przeanalizuj poniższy tekst (może zawierać treść maila oraz tekst wyciągnięty z dokumentów PDF).
Wyciągnij szczegóły ładunku i zwróć WYŁĄCZNIE czysty kod JSON, bez znaczników markdown, bez komentarzy.

Jeśli dane pojawiają się zarówno w mailu jak i w dokumencie PDF, dane z PDF mają priorytet.
Jeśli jakieś dane są niedostępne, użyj null.

Wymagana struktura JSON:
{{
    "loading_city": "Miasto załadunku lub null",
    "loading_zip": "Kod pocztowy załadunku lub null",
    "unloading_city": "Miasto rozładunku lub null",
    "unloading_zip": "Kod pocztowy rozładunku lub null",
    "weight_kg": liczba całkowita lub null,
    "price": liczba dziesiętna lub null,
    "currency": "PLN lub EUR lub inna waluta lub null"
}}

Tekst do analizy:
{capped_text}
"""

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemma-4-26b-a4b-it",
                "provider": {
                    "order": ["Together", "Fireworks", "DeepInfra"]
                },
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.0,
            }
        )

        if response.status_code == 200:
            data = response.json()
            if "choices" not in data or not data["choices"]:
                logger.warning(f"⚠️ Ekstrakcja: brak 'choices' w odpowiedzi: {data}")
                return {}
            result_text = data["choices"][0]["message"]["content"].strip()

            # Pancerne czyszczenie — AI czasem dodaje ```json mimo prośby
            result_text = re.sub(r'```json\n?', '', result_text)
            result_text = re.sub(r'```\n?', '', result_text).strip()

            return json.loads(result_text)
        else:
            logger.error(f"❌ Błąd ekstrakcji (HTTP {response.status_code}): {response.text}")
            return {}

    except json.JSONDecodeError as e:
        logger.error(f"❌ AI zwróciło niepoprawny JSON podczas ekstrakcji: {e}")
        return {}
    except Exception as e:
        logger.error(f"❌ Wyjątek przy ekstrakcji: {e}")
        return {}


# Alias dla kompatybilności wstecznej
extract_load_data = extract_data_from_full_context