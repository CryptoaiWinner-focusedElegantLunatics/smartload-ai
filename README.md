# 🚀 SmartLoad AI

**Autonomiczny Broker Logistyczny napędzany przez AI.** Projekt łączący nowoczesny stack technologiczny z rynkiem TFL (Transport, Forwarding, Logistics). Aplikacja automatycznie fetchuje oferty ładunków z maili oraz giełd zewnętrznych, analizuje je i dopasowuje przy użyciu sztucznej inteligencji.

---

## 🛠 Wymagania wstępne (Zanim zaczniesz)
Aby odpalić ten projekt na swoim komputerze, musisz mieć zainstalowane tylko dwie rzeczy:
1. [Git](https://git-scm.com/) - do pobrania kodu.
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) - środowisko, w którym działa nasza aplikacja i baza danych. **Upewnij się, że Docker jest włączony i działa w tle!**

---

## 🏃‍♂️ Instalacja Krok po Kroku (Idiot-proof setup)

### Krok 1: Pobierz repozytorium
Otwórz terminal w folderze, w którym chcesz trzymać projekt, i wpisz:
```Bash
git clone https://github.com/CryptoaiWinner-focusedElegantLunatics/aplikacja-spedycyjna-ai
cd smartload-ai
```

### Krok 2: Ustawienia (Plik .env)
Nigdy nie wrzucamy haseł na GitHuba! Zamiast tego mamy wzór konfiguracji.
W głównym folderze skopiuj plik .env.example i nazwij go .env.
W systemach Linux/Mac możesz to zrobić komendą:

```Bash
cp .env.example .env
```

### Krok 3: Odpal maszynownię (Docker)
Mając włączonego Docker Desktop, wpisz w terminalu:

```Bash
docker-compose up --build
```

### Krok 4: Wgraj dane testowe (Seed)
Skoro masz czystą bazę, musimy wrzucić do niej jakieś ładunki do testów. Zostaw włączonego Dockera w pierwszej karcie, otwórz nową kartę terminala i wpisz:

```Bash
docker-compose exec backend python -m app.seed
```
🎉 Gotowe! Otwórz przeglądarkę i wejdź na adres: ```http://localhost:8000/db-check.``` Jeśli widzisz status sukcesu i liczbę załadowanych ładunków, masz idealnie skonfigurowane środowisko.

📂 Struktura Projektu (Clean Architecture)
Zanim zaczniesz pisać kod, zobacz, gdzie co leży:

```Plaintext
aplikacja-spedycyjna-ai/
├── app/                  # Kod źródłowy (FastAPI)
│   ├── api/              # Endpointy i routing
│   ├── core/             # Konfiguracja (baza danych, wczytywanie .env)
│   ├── models/           # Modele bazy danych (Pydantic / SQLModel)
│   ├── services/         # Logika biznesowa (Fetching z maili, AI, OCR)
│   ├── main.py           # Punkt wejścia aplikacji
│   └── seed.py           # Skrypt ładujący testowe dane
├── docker-compose.yml    # Orkiestrator Dockera (Apka + Baza)
├── Dockerfile            # Instrukcja budowy środowiska Pythona
├── .env.example          # Wzór haseł i ustawień
└── requirements.txt      # Lista bibliotek Pythona
```
## 📑 Spis Endpointów

---

### 🏠 Widoki / Strony HTML (Templates)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/` | Główny dashboard (wymaga auth) |
| `GET` | `/login` | Strona logowania |
| `POST` | `/login` | Formularz logowania, ustawia cookie JWT |
| `GET` | `/logout` | Wylogowanie, kasuje cookie |
| `GET` | `/mail` | Widok skrzynki mailowej (wymaga auth) |
| `GET` | `/chat` | Widok chatu z AI (wymaga auth) |

---

### 📧 Maile (`/api/emails`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/emails` | Lista maili (filtr: `kategoria`, `szukaj`) |
| `GET` | `/api/stats` | Statystyki maili wg kategorii AI |
| `PUT` | `/api/emails/{email_id}/category` | Zmiana kategorii maila |
| `PUT` | `/api/emails/{email_id}/archive` | Archiwizacja maila (w budowie) |
| `DELETE` | `/api/emails/{email_id}` | Usunięcie pojedynczego maila |
| `POST` | `/api/emails/bulk-delete` | Masowe usuwanie maili |
| `POST` | `/api/emails/rescan` | Re-skanowanie maili "INNE" przez AI |

---

### 📦 Ładunki (`/api/loads`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/loads` | Lista ładunków (filtr: `origin`, `destination`, `source`, paginacja) |
| `GET` | `/api/loads/{load_id}` | Szczegóły pojedynczego ładunku |
| `POST` | `/api/loads` | Dodanie ładunku (format fireTMS) |
| `POST` | `/api/loads/own` | Dodanie własnego zlecenia |

---

### 🏢 Kontrahenci (`/api/contractors`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/contractors` | Lista kontrahentów (z paginacją) |
| `GET` | `/api/contractors/count` | Liczba kontrahentów |
| `GET` | `/api/contractors/{contractor_id}/bank-accounts` | Konta bankowe kontrahenta |
| `POST` | `/api/contractors` | Dodanie nowego kontrahenta |

---

### 📋 Oferty (`/api/offers`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/offers` | Lista wszystkich ofert |
| `GET` | `/api/offers/{tms_offer_id}` | Szczegóły oferty |
| `POST` | `/api/offers` | Tworzenie nowej oferty |
| `PUT` | `/api/offers/{tms_offer_id}` | Aktualizacja oferty |
| `PUT` | `/api/offers/{tms_offer_id}/publications/{exchange_offer_id}` | Aktualizacja publikacji oferty na giełdzie |
| `DELETE` | `/api/offers/{tms_offer_id}` | Usunięcie oferty |
| `DELETE` | `/api/offers/{tms_offer_id}/publications/{exchange_offer_id}` | Usunięcie publikacji oferty |

---

### 🚛 Zlecenia (`/api/orders`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/orders` | Lista zleceń (filtr: `status`, paginacja) |
| `GET` | `/api/orders/{order_id}` | Szczegóły zlecenia |
| `POST` | `/api/transport-order` | Tworzenie nowego zlecenia transportowego |

---

### 🏬 Oddziały i Słowniki (`/api/departments`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/departments` | Lista oddziałów |
| `GET` | `/api/departments/{department_id}` | Szczegóły oddziału |
| `POST` | `/api/departments` | Tworzenie oddziału |
| `POST` | `/api/departments/{department_id}` | Aktualizacja oddziału |
| `GET` | `/api/currency-tables` | Tabele kursów walut (NBP) |
| `GET` | `/api/purchase-service-type` | Typy usług zakupowych |
| `GET` | `/api/purchase-tax-rates` | Stawki podatkowe |
| `GET` | `/api/unit-of-measure` | Jednostki miary |
| `PUT` | `/api/payment` | Oznaczenie płatności |

---

### 📊 Giełda (`/api/exchange`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/exchange/raw-offers` | Oferty ze scrapera (filtr: `origin`, `destination`, `min_price`, `max_price`, `source`) |
| `POST` | `/api/exchange/publish-loads` | Masowa publikacja ładunków jako oferty giełdowe |
| `GET` | `/api/exchange/stats` | Statystyki giełdowe dla dashboardu |

---

### 📄 Dokumenty (`/documents`)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/documents/parse` | Upload PDF → ekstrakcja tekstu (OCR) |
| `POST` | `/documents/extract` | Upload PDF → dane przesyłki przez LLM (AI) |

---

### 🔧 Narzędzia / Debug

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/db-check` | Sprawdzenie połączenia z bazą, liczba ładunków |
| `GET` | `/loads` | Bezpośredni odczyt ładunków z DB (legacy) |
| `POST` | `/sync-emails` | Ręczne wyzwolenie synchronizacji IMAP w tle |
| `POST` | `/sync-loads` | Ręczne uruchomienie scrapera |
| `GET` | `/test-ai-triage` | Raport testowy triażu AI na 5 przykładowych mailach |
| `GET` | `/seed-danych` | Załadowanie testowych danych do DB |
| `GET` | `/magiczny-guzik` | Tworzenie superusera admina |
| `WebSocket` | `/ws/chat` | WebSocket – chat z AI dla kierowcy |
