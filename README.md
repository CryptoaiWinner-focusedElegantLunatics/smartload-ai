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

###Krok 4: Wgraj dane testowe (Seed)
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
