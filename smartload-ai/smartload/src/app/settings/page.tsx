"use client";

import { useEffect, useState, Suspense } from "react";
import Sidebar from "../components/Sidebar";

interface ImapSettings {
  email_user: string;
  email_password: string;
  email_imap_server: string;
  email_imap_port: number;
}

function SettingsPageInner() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const cBorder = isDark ? "#252525" : "#e2e8f0";
  const cBg = isDark ? "#0a0a0a" : "#f8fafc";
  const cSurface = isDark ? "#111111" : "#ffffff";
  const cHover = isDark ? "#191919" : "#f1f5f9";
  const cText = isDark ? "#e8e8e8" : "#0f172a";
  const cMuted = isDark ? "#888888" : "#64748b";
  const cFaint = isDark ? "#555555" : "#94a3b8";
  const cPrimary = "#3b82f6";
  const cGreen = "#22c55e";

  const [form, setForm] = useState<ImapSettings>({
    email_user: "",
    email_password: "",
    email_imap_server: "imap.gmail.com",
    email_imap_port: 993,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // Załaduj aktualne ustawienia
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/backend/api/settings/imap", {
          credentials: "include",
        });
        if (r.ok) {
          const data = await r.json();
          setForm({
            email_user: data.email_user || "",
            email_password: data.email_password || "",
            email_imap_server: data.email_imap_server || "imap.gmail.com",
            email_imap_port: data.email_imap_port || 993,
          });
        }
      } catch {
        // brak ustawień — zostają defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!form.email_user || !form.email_password || !form.email_imap_server) {
      showToast("error", "Wypełnij wszystkie wymagane pola.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/backend/api/settings/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      showToast("success", "Ustawienia IMAP zostały zapisane.");
    } catch {
      showToast("error", "Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!form.email_user || !form.email_password || !form.email_imap_server) {
      showToast("error", "Wypełnij wszystkie pola przed testem.");
      return;
    }
    setTesting(true);
    try {
      const r = await fetch("/api/backend/api/settings/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        showToast(
          "success",
          `✅ Połączenie działa! Znaleziono ${data.message_count ?? "?"} wiadomości.`,
        );
      } else {
        showToast(
          "error",
          `❌ Błąd połączenia: ${data.detail || "Nieznany błąd"}`,
        );
      }
    } catch {
      showToast("error", "Nie udało się przetestować połączenia.");
    } finally {
      setTesting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "0.6rem 0.875rem",
    border: `1px solid ${cBorder}`,
    borderRadius: 8,
    background: cBg,
    color: cText,
    fontSize: 13,
    boxSizing: "border-box" as const,
    outline: "none",
  };

  const labelStyle = {
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    color: cFaint,
    display: "block",
    marginBottom: 6,
  };

  const PRESET_SERVERS = [
    { label: "Gmail", imap: "imap.gmail.com", port: 993 },
    { label: "Outlook", imap: "outlook.office365.com", port: 993 },
    { label: "Yahoo", imap: "imap.mail.yahoo.com", port: 993 },
    { label: "O2 / WP", imap: "imap.o2.pl", port: 993 },
    { label: "Onet", imap: "imap.poczta.onet.pl", port: 993 },
  ];

  return (
    <>
      <style>{`
        .settings-input:focus { border-color: ${cPrimary} !important; }
        .preset-btn:hover { border-color: ${cPrimary} !important; color: ${cPrimary} !important; }
        @keyframes _fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: cBg,
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Top bar */}
          <header
            style={{
              height: 56,
              flexShrink: 0,
              background: cSurface,
              borderBottom: `1px solid ${cBorder}`,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 16,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: cText,
                  margin: 0,
                }}
              >
                Ustawienia
              </h2>
              <p style={{ fontSize: 12, color: cMuted, margin: 0 }}>
                Konfiguracja połączenia IMAP i skrzynki pocztowej
              </p>
            </div>
          </header>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "2rem",
              background: cBg,
            }}
          >
            <div
              style={{
                maxWidth: 640,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Sekcja: Konto email */}
              <div
                style={{
                  background: cSurface,
                  border: `1px solid ${cBorder}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "1.25rem 1.5rem",
                    borderBottom: `1px solid ${cBorder}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(59,130,246,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={cPrimary}
                      strokeWidth="2"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{ fontSize: 13, fontWeight: 700, color: cText }}
                    >
                      Konto e-mail (IMAP)
                    </div>
                    <div style={{ fontSize: 11, color: cMuted }}>
                      Dane logowania do skrzynki pocztowej
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: cFaint,
                      fontSize: 12,
                    }}
                  >
                    Ładowanie ustawień…
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    {/* Presety dostawców */}
                    <div>
                      <label style={labelStyle}>Szybki wybór dostawcy</label>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        {PRESET_SERVERS.map((p) => (
                          <button
                            key={p.label}
                            className="preset-btn"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                email_imap_server: p.imap,
                                email_imap_port: p.port,
                              }))
                            }
                            style={{
                              padding: "0.35rem 0.875rem",
                              borderRadius: 20,
                              border: `1px solid ${form.email_imap_server === p.imap ? cPrimary : cBorder}`,
                              background:
                                form.email_imap_server === p.imap
                                  ? "rgba(59,130,246,0.1)"
                                  : "transparent",
                              color:
                                form.email_imap_server === p.imap
                                  ? cPrimary
                                  : cMuted,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label style={labelStyle}>
                        Adres e-mail <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        className="settings-input"
                        type="email"
                        placeholder="twoj.email@gmail.com"
                        value={form.email_user}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email_user: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </div>

                    {/* Hasło */}
                    <div>
                      <label style={labelStyle}>
                        Hasło aplikacji{" "}
                        <span style={{ color: "#ef4444" }}>*</span>
                        <span
                          style={{
                            color: cFaint,
                            fontWeight: 400,
                            fontSize: 9,
                            marginLeft: 6,
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          (dla Gmail: Konto Google → Bezpieczeństwo → Hasła do
                          aplikacji)
                        </span>
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          className="settings-input"
                          type={showPass ? "text" : "password"}
                          placeholder="••••••••••••••••"
                          value={form.email_password}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              email_password: e.target.value,
                            }))
                          }
                          style={{ ...inputStyle, paddingRight: "2.5rem" }}
                        />
                        <button
                          onClick={() => setShowPass((v) => !v)}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: cFaint,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {showPass ? (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* IMAP server + port */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label style={labelStyle}>
                          Serwer IMAP{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          className="settings-input"
                          type="text"
                          placeholder="imap.gmail.com"
                          value={form.email_imap_server}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              email_imap_server: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Port</label>
                        <input
                          className="settings-input"
                          type="number"
                          value={form.email_imap_port}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              email_imap_port: Number(e.target.value),
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    {/* Info box dla Gmail */}
                    {form.email_imap_server.includes("gmail") && (
                      <div
                        style={{
                          background: "rgba(59,130,246,0.07)",
                          border: `1px solid rgba(59,130,246,0.2)`,
                          borderRadius: 8,
                          padding: "0.875rem 1rem",
                          fontSize: 12,
                          color: cMuted,
                          lineHeight: 1.65,
                        }}
                      >
                        <strong style={{ color: cPrimary }}>
                          💡 Gmail wymaga hasła do aplikacji
                        </strong>
                        <br />
                        Zwykłe hasło nie zadziała jeśli masz 2FA. Wejdź na{" "}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: cPrimary }}
                        >
                          myaccount.google.com/apppasswords
                        </a>{" "}
                        → wygeneruj hasło dla „Poczta" i wklej je tutaj.
                      </div>
                    )}

                    {/* Przyciski */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        justifyContent: "flex-end",
                        paddingTop: "0.5rem",
                        borderTop: `1px solid ${cBorder}`,
                      }}
                    >
                      <button
                        onClick={handleTest}
                        disabled={testing}
                        style={{
                          padding: "0.575rem 1.25rem",
                          borderRadius: 8,
                          border: `1px solid ${cBorder}`,
                          background: "transparent",
                          color: cText,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          opacity: testing ? 0.7 : 1,
                        }}
                      >
                        {testing ? (
                          <>
                            <div
                              style={{
                                width: 13,
                                height: 13,
                                border: `2px solid ${cMuted}`,
                                borderTopColor: "transparent",
                                borderRadius: "50%",
                                animation: "spin 0.7s linear infinite",
                              }}
                            />
                            Testowanie…
                          </>
                        ) : (
                          <>
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            Testuj połączenie
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          padding: "0.575rem 1.5rem",
                          borderRadius: 8,
                          border: "none",
                          background: saving ? cMuted : cPrimary,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                          opacity: saving ? 0.8 : 1,
                        }}
                      >
                        {saving ? "Zapisywanie…" : "💾 Zapisz ustawienia"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sekcja: Informacje */}
              <div
                style={{
                  background: cSurface,
                  border: `1px solid ${cBorder}`,
                  borderRadius: 12,
                  padding: "1.25rem 1.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: cFaint,
                    marginBottom: "0.875rem",
                  }}
                >
                  Gdzie są przechowywane dane?
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: cMuted,
                    lineHeight: 1.75,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    📁 Ustawienia są zapisywane w bazie danych aplikacji (tabela{" "}
                    <code
                      style={{
                        background: cHover,
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      imap_settings
                    </code>
                    ).
                  </div>
                  <div>
                    🔒 Hasło jest przechowywane w postaci{" "}
                    <strong>zaszyfrowanej</strong> (AES-256).
                  </div>
                  <div>
                    ⚙️ Jeśli ustawienia nie są zapisane, aplikacja używa
                    wartości z pliku{" "}
                    <code
                      style={{
                        background: cHover,
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      .env
                    </code>{" "}
                    jako fallback.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 500,
            background:
              toast.type === "success"
                ? isDark
                  ? "#052e16"
                  : "#f0fdf4"
                : isDark
                  ? "#2d0f0f"
                  : "#fef2f2",
            border: `1px solid ${toast.type === "success" ? "#22c55e" : "#ef4444"}`,
            borderRadius: 10,
            padding: "0.875rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            animation: "_fadeIn 0.2s ease",
            maxWidth: 380,
            fontSize: 13,
            fontWeight: 600,
            color: toast.type === "success" ? cGreen : "#ef4444",
          }}
        >
          {toast.type === "success" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
