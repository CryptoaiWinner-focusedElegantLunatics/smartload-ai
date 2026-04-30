"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../components/AuthContext";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const { refreshAuth, role, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Jeśli wchodzimy na /login mając aktywną sesję → dashboard
  useEffect(() => {
    if (!isLoading && role !== null) {
      router.replace("/dashboard");
    }
  }, [isLoading, role, router]);

  // Pokaż blank podczas ładowania (zapobiega flashowi formularza)
  if (isLoading) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch("/api/backend/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        credentials: "include",
        cache: "no-store",
      });

      if (res.ok) {
        // ✅ Potwierdź sesję przez /api/me zanim zrobimy redirect
        const ok = await refreshAuth();
        if (ok) {
          router.replace("/dashboard");
        } else {
          setError("Nie udało się potwierdzić sesji. Spróbuj ponownie.");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Nieprawidłowy login lub hasło.");
      }
    } catch {
      setError("Błąd połączenia z serwerem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-brand">
          <Link href="/" className="login-logo">
            SmartLoad AI
          </Link>
          <p className="login-tagline">Platforma Spedycyjna Nowej Generacji</p>
        </div>
        <div className="login-left-content">
          <h1>Witaj z powrotem!</h1>
          <p>
            Zaloguj się i zarządzaj ładunkami z pomocą sztucznej inteligencji.
          </p>
          <ul className="login-features">
            <li>
              <span className="check">✓</span> Automatyczna ekstrakcja danych z
              maili
            </li>
            <li>
              <span className="check">✓</span> Agregacja ofert z wielu giełd
            </li>
            <li>
              <span className="check">✓</span> Optymalizacja tras w czasie
              rzeczywistym
            </li>
          </ul>
        </div>
        <div className="login-left-badge">
          <span className="badge-number">98%</span>
          <span className="badge-label">Dokładność AI</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Zaloguj się</h2>
            <p>Wprowadź swoje dane dostępowe</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Nazwa użytkownika</label>
              <input
                id="username"
                type="text"
                placeholder="twój_login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">
                Hasło
                <a className="forgot-link">Zapomniałeś hasła?</a>
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-login-submit"
              disabled={loading}
            >
              {loading ? "Logowanie..." : "Zaloguj się →"}
            </button>
          </form>

          <p className="login-register">
            Nie masz konta? <a className="forgot-link">Skontaktuj się z nami</a>
          </p>
        </div>
      </div>
    </div>
  );
}
