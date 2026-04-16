Mordo, to świetny moment na zebranie wszystkiego "do kupy". Projekt wyrasta na naprawdę konkretne narzędzie, które może namieszać w branży TSL. Poniżej przygotowałem dla Ciebie kompletny dokument – Project Context & Status Report. Możesz go wkleić do czatu z innym devem, wrzucić na GitHuba jako README.md albo zachować dla siebie jako mapę drogową.

🚛 Raport Projektu: SmartLoad AI
Status: MVP (Minimum Viable Product) – Etap Klasyfikacji i Interfejsu.
Cel: Automatyzacja pracy spedytora poprzez inteligentne łączenie ofert z giełd, maili i czatu z kierowcami w jeden ekosystem.

1. Ogólny Zamysł Projektu (The Vision)
SmartLoad AI to "cyfrowy asystent spedytora", który działa jako centralny hub danych. System monitoruje wiele źródeł (skrzynki pocztowe, giełdy transportowe, komunikator kierowców), a następnie przy użyciu modeli językowych (LLM - Gemma 2/Llama 3):

Rozpoznaje intencję: Czy to zapytanie o cenę, gotowe zlecenie, czy skan dokumentu?

Ekstrahuje dane: Wyciąga kluczowe parametry (trasa, waga, cena) bez udziału człowieka.

Dopasowuje: Szuka najlepszego połączenia między wolnym ładunkiem a kierowcą zgłaszającym trasę na czacie.

Zamyka obieg dokumentów: Automatycznie generuje listy przewozowe i archiwizuje potwierdzenia dostaw.

2. Co już mamy zrobione? (Aktualny Stack i Funkcje)
🏗️ Infrastruktura (Backend)
Technologia: FastAPI (Python 3.11+) + SQLModel (Baza danych).

Konteneryzacja: Pełne środowisko Docker Compose (Backend, Celery Worker, Redis, Baza Postgres).

Background Tasks: Celery + Redis – pobieranie i analiza maili odbywa się asynchronicznie, nie obciążając interfejsu.

🤖 Silnik AI (Triage)
Model: Gemma 2 (27B) via OpenRouter / Groq.

Funkcja: Automatyczna kategoryzacja maili na: OFERTA, ZAMOWIENIE, FAKTURA, DOKUMENT_CMR, INNE.

Niezawodność: Wdrożony mechanizm Retry (ponawianie przy błędach API) oraz śledzenie zużycia tokenów.

📊 Dashboard Spedytora (UI)
Frontend: Tailwind CSS + Jinja2 Templates (lekki, szybki interfejs).

Funkcje: * Podgląd listy maili w czasie rzeczywistym.

Filtrowanie po kategoriach AI i wyszukiwarka tekstowa.

Modal Viewer: Możliwość odczytania pełnej treści maila bezpośrednio w panelu.

Manual Override: Możliwość ręcznej poprawy kategorii, jeśli AI się pomyli.

Archiwizacja: Systemowe odkładanie przetworzonych ładunków "na bok".

3. Co przed nami? (Roadmapa)
🛰️ Komunikator i Aplikacja Kierowcy
Zadanie: Stworzenie prostego interfejsu czatu, gdzie kierowca zgłasza: "Jestem wolny w Berlinie, jadę na pustko do Warszawy".

Automatyzacja: System odczytuje tę wiadomość, paruje ją z dostępnymi w bazie OFERTAMI i proponuje ładunek.

📄 Integracja Dokumentacji (document.py)
Zadanie: Spięcie gotowego modułu do generowania listów przewozowych.

Workflow: Kierowca dostaje dopasowany ładunek -> Klika "Akceptuję" -> System generuje PDF (CMR) i wysyła mu na czat.

🏁 Zamknięcie Ładunku (Delivery Confirmation)
Zadanie: Kierowca po rozładunku robi zdjęcie podbitego CMR i wysyła na czat.

AI: Model rozpoznaje, że to "Potwierdzenie dostawy", zmienia status ładunku na ZAKOŃCZONY i zapisuje wszystko w historii.