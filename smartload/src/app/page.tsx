"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      {/* NAV */}
      <nav className="landing-nav">
        <div className="logo">SmartLoad AI</div>
        <ul className="nav-links">
          <li>
            <a href="#funkcje">Funkcje</a>
          </li>
          <li>
            <a href="#platforma">Platforma</a>
          </li>
          <li>
            <a href="#dzien">Dzień z AI</a>
          </li>
          <li>
            <a href="#kontakt">Kontakt</a>
          </li>
        </ul>
        <div className="nav-buttons">
          <Link href="/login">
            <button className="btn-login">Zaloguj się</button>
          </Link>
          <Link href="/login">
            <button className="btn-started">Rozpocznij →</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero fade-in">
        <div className="hero-content">
          <h2>Platforma Spedycyjna Nowej Generacji</h2>
          <h1>
            Automatyzuj spedycję z{" "}
            <span className="highlight">SmartLoad AI</span>
          </h1>
          <p>
            Łączymy nowoczesną technologię ze specyfiką rynku TFL. SmartLoad AI
            to Twoja nowa przewaga konkurencyjna w świecie cyfrowej spedycji.
          </p>
          <div className="hero-buttons">
            <Link href="/login">
              <button className="btn-primary">Zacznij za darmo →</button>
            </Link>
            <button className="btn-secondary">Zobacz demo</button>
          </div>
        </div>
        <div className="hero-image">
          <img src="/hero-preview.png" alt="SmartLoad AI Dashboard" />
          <div className="accuracy-badge">
            <div className="number">98%</div>
            <div className="label">
              Dokładność
              <br />
              Ekstrakcji Danych
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section className="platform" id="platforma">
        <div className="platform-header">
          <div className="platform-image">
            <img src="/platform-preview.png" alt="Platforma SmartLoad" />
          </div>
          <div className="platform-content">
            <p className="platform-label">O Platformie</p>
            <h2>
              SmartLoad AI to autorski projekt, który fundamentalnie zmienia
              sposób pracy spedytora.
            </h2>
            <p>
              Nasz system automatycznie monitoruje skrzynki mailowe oraz
              zewnętrzne giełdy ładunków w czasie rzeczywistym.
            </p>
            <p>
              Zamiast tracić godziny na kopiowanie danych, pozwalasz AI na
              natychmiastową ekstrakcję parametrów ładunku i ich kategoryzację.
            </p>
          </div>
        </div>
      </section>

      {/* INTELLIGENCE */}
      <section className="intelligence" id="funkcje">
        <h2 className="section-title">Inteligencja, która pracuje za Ciebie</h2>
        <div className="features-grid">
          <div className="feature-card featured">
            <div className="feature-icon">🧠</div>
            <h3>Analiza Semantyczna Maili</h3>
            <p>
              AI interpretuje zapytania mailowe, wyciągając kluczowe dane:
              wymiary, wagę, rodzaj nadwozia i terminy.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔗</div>
            <h3>Agregacja Giełd Ładunków</h3>
            <p>
              Łączymy oferty z wielu źródeł w jeden, czytelny strumień danych
              zasilany silnikiem rekomendacji.
            </p>
          </div>
        </div>
        <div className="features-grid-bottom">
          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3>Optymalizacja Tras</h3>
            <p>
              System sugeruje doładunki i optymalne trasy przejazdu w oparciu o
              aktualne dane GPS.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📧</div>
            <h3>Automatyczny Monitoring</h3>
            <p>
              Automatyczne pobieranie ofert z wiadomości e-mail i giełd
              zewnętrznych w czasie rzeczywistym.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>Weryfikacja Kontrahentów</h3>
            <p>
              Automatyczne sprawdzanie dokumentów i reputacji firm w bazach
              danych.
            </p>
          </div>
        </div>
      </section>

      {/* DAY IN LIFE */}
      <section className="day-in-life" id="dzien">
        <div className="day-in-life-container">
          <div className="day-in-life-content">
            <h2>
              Dzień z <span className="highlight">SmartLoad AI</span>
            </h2>
            <div className="benefits-grid">
              <div className="benefit-item">
                <div className="benefit-icon">⚡</div>
                <div className="benefit-content">
                  <h3>Oszczędność czasu</h3>
                  <p>
                    System wykonuje za Ciebie żmudne zadania, pozwalając skupić
                    się na budowaniu relacji i negocjacjach.
                  </p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">✓</div>
                <div className="benefit-content">
                  <h3>Zero błędów</h3>
                  <p>
                    Brak pomyłek w adresach, terminach czy typach aut. AI
                    weryfikuje każdą ofertę z niespotykana precyzją.
                  </p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">🚀</div>
                <div className="benefit-content">
                  <h3>Przewaga konkurencyjna</h3>
                  <p>
                    Znajdź ładunki idealnie pasujące do Twojej floty w ułamku
                    sekundy, wyprzedzając konkurencję!
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="terminal-section">
            <div className="terminal">
              <div className="terminal-header">
                <span className="terminal-title">smartload-ai — monitor</span>
                <div className="terminal-buttons">
                  <div className="terminal-btn red"></div>
                  <div className="terminal-btn yellow"></div>
                  <div className="terminal-btn green"></div>
                </div>
              </div>
              <div className="terminal-line timestamp">
                [08:14:32] System uruchomiony
              </div>
              <div className="terminal-line success">
                [08:14:33] ✓ Połączono z giełdami ładunków
              </div>
              <div className="terminal-line warning">
                [08:14:45] ⚡ Nowy mail: "Ładunek DE→PL, 24t"
              </div>
              <div className="terminal-line success">
                [08:14:46] ✓ Ekstrakcja danych: 98% pewności
              </div>
              <div className="terminal-line timestamp">
                [08:14:47] Szukam pasujących ofert...
              </div>
              <div className="terminal-line success">
                [08:14:48] ✓ Znaleziono 3 optymalne doładunki
              </div>
              <div className="terminal-line highlight">
                → Oszczędność: 340 km trasy
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Dołącz do grona nowoczesnych firm spedycyjnych</h2>
        <p>Które już teraz optymalizują swoje procesy z SmartLoad AI.</p>
        <Link href="/login">
          <button className="cta-button">Zacznij za darmo →</button>
        </Link>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-container">
          <div className="footer-section">
            <h4>SmartLoad AI</h4>
            <ul>
              <li>
                <a href="#funkcje">Funkcje</a>
              </li>
              <li>
                <a href="#platforma">Platforma</a>
              </li>
              <li>
                <a href="#dzien">Dzień z AI</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Produkt</h4>
            <ul>
              <li>
                <a href="#">Dokumentacja</a>
              </li>
              <li>
                <a href="#">API</a>
              </li>
              <li>
                <a href="#">Cennik</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Firma</h4>
            <ul>
              <li>
                <a href="#">O nas</a>
              </li>
              <li>
                <a href="#">Kontakt</a>
              </li>
              <li>
                <a href="#">Polityka prywatności</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-logo">SmartLoad AI</div>
          <div className="footer-copy">
            © 2025 SmartLoad AI. Wszelkie prawa zastrzeżone.
          </div>
        </div>
      </footer>
    </>
  );
}
