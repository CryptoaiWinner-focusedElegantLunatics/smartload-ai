"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import RoleGuard from "../components/RoleGuard";

interface AssignedRoute {
  id: number;
  driver_id: number;
  assigned_by_id: number | null;
  assigned_by_email: string | null;
  source_id: string | null;
  loading_city: string;
  unloading_city: string;
  weight_kg: number;
  price: number;
  status: string;
  cmr_path: string | null;
  assigned_at: string;
}

const STATUS_OPTIONS = ["PRZYPISANE", "W DRODZE", "ROZŁADOWANE"] as const;

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  PRZYPISANE:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  "W DRODZE":  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  ROZŁADOWANE: { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
};

/** Obserwuje klasę .dark na <html> i zwraca aktualny stan motywu */
function useTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    update();
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function Chip({
  icon,
  label,
  isDark,
}: {
  icon: string;
  label: string;
  isDark: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        padding: "5px 12px",
        borderRadius: 8,
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0"}`,
        color: isDark ? "#94a3b8" : "#475569",
      }}
    >
      {icon} {label}
    </span>
  );
}

function RouteCard({
  route,
  onStatusChange,
  onDownloadCMR,
  isGeneratingCMR,
  isDark,
}: {
  route: AssignedRoute;
  onStatusChange: (id: number, status: string) => void;
  onDownloadCMR: (id: number) => void;
  isGeneratingCMR: boolean;
  isDark: boolean;
}) {
  const style = STATUS_STYLE[route.status] ?? STATUS_STYLE["PRZYPISANE"];
  const date = new Date(route.assigned_at).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const cardBg     = isDark ? "#191919" : "#ffffff";
  const cardBorder = isDark ? "#252525" : "#e2e8f0";
  const textColor  = isDark ? "#f1f5f9" : "#1e293b";
  const mutedColor = isDark ? "#64748b" : "#94a3b8";

  return (
    <div
      style={{
        borderRadius: 14,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "transform 0.2s, box-shadow 0.2s",
        animation: "slideUp 0.35s ease both",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = isDark
          ? "0 8px 32px rgba(0,0,0,0.35)"
          : "0 8px 32px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Trasa */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Ikona pojazdu */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
          }}
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13" />
            <polyline points="16 8 20 8 23 11 23 16 16 16" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: textColor,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {route.loading_city}
            <span style={{ margin: "0 8px", color: "#3b82f6" }}>→</span>
            {route.unloading_city}
          </div>
          <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>
            Przypisano: {date}
          </div>
          {route.assigned_by_email && (
            <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <span>👤</span>
              <span>Przypisał: <b>{route.assigned_by_email}</b></span>
            </div>
          )}
        </div>

        {/* Badge statusu */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            padding: "4px 12px",
            borderRadius: 100,
            color: style.color,
            background: style.bg,
            border: `1px solid ${style.border}`,
            flexShrink: 0,
          }}
        >
          {route.status}
        </span>
      </div>

      {/* Szczegóły */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Chip icon="⚖️" label={`${route.weight_kg.toLocaleString("pl-PL")} kg`} isDark={isDark} />
        <Chip icon="💶" label={`${route.price.toLocaleString("pl-PL", { minimumFractionDigits: 0 })} EUR`} isDark={isDark} />
        {route.source_id && (
          <Chip icon="🔗" label={`ID: ${route.source_id.slice(0, 12)}…`} isDark={isDark} />
        )}
      </div>

      {/* Zmiana statusu + CMR */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderTop: `1px solid ${cardBorder}`,
          paddingTop: 14,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: mutedColor,
            alignSelf: "center",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Zmień status:
        </span>

        {STATUS_OPTIONS.filter((s) => s !== route.status).map((s) => {
          const st = STATUS_STYLE[s];
          return (
            <button
              key={s}
              onClick={() => onStatusChange(route.id, s)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${st.border}`,
                background: st.bg,
                color: st.color,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {s}
            </button>
          );
        })}

        {/* Przycisk CMR */}
        <div style={{ marginLeft: "auto" }}>
          {route.cmr_path ? (
            <button
              onClick={() => onDownloadCMR(route.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16,185,129,0.35)",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Pokaż CMR
            </button>
          ) : (
            <button
              onClick={() => onDownloadCMR(route.id)}
              disabled={isGeneratingCMR}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                background: isGeneratingCMR
                  ? "rgba(99,102,241,0.35)"
                  : "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: isGeneratingCMR ? "not-allowed" : "pointer",
                boxShadow: isGeneratingCMR ? "none" : "0 4px 12px rgba(99,102,241,0.35)",
                transition: "all 0.2s",
                opacity: isGeneratingCMR ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isGeneratingCMR ? (
                <>
                  <svg
                    style={{ animation: "spin 1s linear infinite" }}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Generowanie…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                  Generuj CMR
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MyRoutesInner() {
  const isDark = useTheme();

  const [routes, setRoutes] = useState<AssignedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [generatingCMR, setGeneratingCMR] = useState<Set<number>>(new Set());

  // Kolory zależne od motywu
  const pageBg      = isDark ? "#0a0a0a"  : "#f1f5f9";
  const headerBg    = isDark ? "#111111"  : "#ffffff";
  const border      = isDark ? "#252525"  : "#e2e8f0";
  const textColor   = isDark ? "#e8e8e8"  : "#1e293b";
  const mutedColor  = isDark ? "#888888"  : "#64748b";
  const faintColor  = isDark ? "#64748b"  : "#94a3b8";

  const fetchRoutes = () => {
    setIsLoading(true);
    fetch("/api/backend/api/routes/my-routes", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Błąd ${r.status}`);
        return r.json();
      })
      .then(setRoutes)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchRoutes(); }, []);

  const handleStatusChange = async (routeId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/backend/api/routes/${routeId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Błąd ${res.status}`);
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, status: newStatus } : r))
      );
      setToast(`✓ Status zmieniony na: ${newStatus}`);
      setTimeout(() => setToast(null), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Błąd zmiany statusu");
    }
  };

  const handleDownloadCMR = async (routeId: number) => {
    const route = routes.find((r) => r.id === routeId);
    if (route?.cmr_path) {
      window.open(`/api/backend/api/routes/${routeId}/cmr`, "_blank");
      return;
    }
    setGeneratingCMR((prev) => new Set(prev).add(routeId));
    try {
      const res = await fetch(`/api/backend/api/routes/${routeId}/cmr`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Błąd serwera (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, cmr_path: "generated" } : r))
      );
      setToast("✓ CMR wygenerowany pomyślnie!");
      setTimeout(() => setToast(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Błąd generowania CMR");
    } finally {
      setGeneratingCMR((prev) => {
        const s = new Set(prev);
        s.delete(routeId);
        return s;
      });
    }
  };

  const grouped = {
    PRZYPISANE:  routes.filter((r) => r.status === "PRZYPISANE"),
    "W DRODZE":  routes.filter((r) => r.status === "W DRODZE"),
    ROZŁADOWANE: routes.filter((r) => r.status === "ROZŁADOWANE"),
  };

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .page-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }
      `}</style>

      <div
        className="page-container"
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          background: pageBg,
          transition: "background 0.2s",
        }}
      >
        <Sidebar />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <header
            style={{
              height: 56,
              flexShrink: 0,
              background: headerBg,
              borderBottom: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 16,
              transition: "background 0.2s, border-color 0.2s",
            }}
          >
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: textColor,
                  margin: 0,
                  transition: "color 0.2s",
                }}
              >
                Moje Trasy
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: mutedColor,
                  margin: 0,
                  transition: "color 0.2s",
                }}
              >
                Trasy przypisane do Ciebie przez dyspozytora
              </p>
            </div>
            <button
              onClick={fetchRoutes}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#cbd5e1"}`,
                background: isDark ? "rgba(59,130,246,0.08)" : "#f1f5f9",
                color: "#60a5fa",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              ↺ Odśwież
            </button>
          </header>

          {/* Główna treść */}
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "2rem",
              background: pageBg,
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                maxWidth: 900,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 32,
              }}
            >
              {/* Tytuł */}
              <div>
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: textColor,
                    margin: "0 0 6px 0",
                    transition: "color 0.2s",
                  }}
                >
                  Moje Trasy
                </h1>
                <p
                  style={{
                    fontSize: 13,
                    color: mutedColor,
                    margin: 0,
                    transition: "color 0.2s",
                  }}
                >
                  Przeglądaj zlecenia i aktualizuj status realizacji
                </p>
              </div>

              {/* Statystyki */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {(Object.entries(grouped) as [string, AssignedRoute[]][]).map(([status, list]) => {
                  const st = STATUS_STYLE[status];
                  return (
                    <div
                      key={status}
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: 12,
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                      }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 800, color: st.color }}>
                        {list.length}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: st.color,
                          opacity: 0.8,
                          marginTop: 2,
                        }}
                      >
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stany ładowania / błędu / pustej listy */}
              {isLoading && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: mutedColor,
                    fontSize: 14,
                  }}
                >
                  Ładowanie tras…
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              {!isLoading && !error && routes.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "4rem 2rem",
                    color: mutedColor,
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🚛</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: faintColor,
                      marginBottom: 8,
                    }}
                  >
                    Brak przypisanych tras
                  </div>
                  <div style={{ fontSize: 13 }}>
                    Dyspozytorzy nie przypisali Ci jeszcze żadnych zleceń.
                  </div>
                </div>
              )}

              {/* Lista tras pogrupowana wg statusu */}
              {(Object.entries(grouped) as [string, AssignedRoute[]][]).map(([status, list]) => {
                if (list.length === 0) return null;
                const st = STATUS_STYLE[status];
                return (
                  <div key={status}>
                    {/* Nagłówek grupy */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          color: st.color,
                          background: st.bg,
                          border: `1px solid ${st.border}`,
                          padding: "3px 12px",
                          borderRadius: 100,
                        }}
                      >
                        {status}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          background: isDark ? "#252525" : "#e2e8f0",
                        }}
                      />
                    </div>

                    {/* Karty tras */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {list.map((route) => (
                        <RouteCard
                          key={route.id}
                          route={route}
                          onStatusChange={handleStatusChange}
                          onDownloadCMR={handleDownloadCMR}
                          isGeneratingCMR={generatingCMR.has(route.id)}
                          isDark={isDark}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#10b981",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(16,185,129,0.45)",
            animation: "fadeIn 0.3s ease",
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

export default function MyRoutesPage() {
  return (
    <RoleGuard allowedRoles={["KIEROWCA", "ADMIN"]}>
      <MyRoutesInner />
    </RoleGuard>
  );
}
