"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../components/AuthContext";

interface Stats {
  [key: string]: number;
}

const PALETTE: Record<string, string> = {
  OFERTA: "#0035c5",
  ZAMOWIENIE: "#00daf3",
  FAKTURA: "#8b5cf6",
  DOKUMENT_CMR: "#f59e0b",
  INNE: "#64748b",
};

function colorFor(cat: string, customPalette: Record<string, string> = {}): string {
  if (PALETTE[cat]) return PALETTE[cat];
  if (customPalette[cat]) return customPalette[cat];

  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return (
    "#" +
    ((Math.abs(h) & 0xffffff) | 0x404040)
      .toString(16)
      .slice(-6)
      .padStart(6, "0")
  );
}

function animateCounter(el: HTMLElement, target: number, duration = 800) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = String(Math.floor(start));
    if (start >= target) clearInterval(timer);
  }, 16);
}

const StatCard = ({ label, value, total, color }: { label: string, value: number, total: number, color: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) animateCounter(ref.current, value);
    if (barRef.current) {
      const pct = total > 0 ? (value / total) * 100 : 0;
      barRef.current.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
  }, [value, total]);

  return (
    <div className="stat-card">
      <p className="stat-label-dash">{label}</p>
      <div className="stat-value-row">
        <span className="stat-number-dash" ref={ref}>0</span>
      </div>
      <div className="stat-progress">
        <div className="stat-bar" ref={barRef} style={{ background: color }} />
      </div>
    </div>
  );
};

const CIRCUMFERENCE = 2 * Math.PI * 80;

const EfficiencyChart = ({ stats, total, customPalette }: { stats: Stats; total: number; customPalette: Record<string, string> }) => {
  const chartData = Object.entries(stats)
    .filter(([, v]) => v > 0)
    .map(([cat, val]) => ({
      name: cat,
      value: val,
      color: colorFor(cat, customPalette),
    }));

  if (total === 0) return null;

  const size = 260;
  const radius = 80;
  const strokeWidth = 30; // Pogrubiamy nieco dla lepszej widoczności
  const circumference = 2 * Math.PI * radius;

  // Normalize lengths to ensure small values are visible but total is exactly circumference
  let totalMinLength = 0;
  const processedData = chartData.map(item => {
    const rawLength = (item.value / total) * circumference;
    const length = item.value > 0 ? Math.max(rawLength, circumference * 0.03) : 0; // min 3% for visibility
    totalMinLength += length;
    return { ...item, length };
  });

  // Re-scale to exactly circumference
  const scale = totalMinLength > circumference ? circumference / totalMinLength : 1;
  const finalData = processedData.map(item => ({
    ...item,
    length: item.length * scale
  }));

  // Start at the top
  let currentOffset = -circumference / 4;

  return (
    <div className="chart-body">
      <div className="donut-wrapper">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 200 200`}
          className="donut-svg"
        >
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-progress-bg)"
            strokeWidth={strokeWidth}
          />
          {finalData.map((item) => {
            const strokeDasharray = `${item.length} ${circumference - item.length}`;
            const strokeDashoffset = currentOffset;

            const segment = (
              <circle
                key={item.name}
                cx="100"
                cy="100"
                r={radius}
                className="donut-seg"
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
              />
            );

            currentOffset -= item.length;
            return segment;
          })}
        </svg>
        <div className="donut-center">
          <span className="donut-pct">100%</span>
          <span className="donut-sublabel">Łącznie</span>
        </div>
      </div>
      <div className="donut-legend">
        {chartData.map((item) => (
          <div key={item.name} className="donut-legend-item" title={item.name}>
            <span
              className="donut-legend-dot"
              style={{ background: item.color }}
            />
            <span className="donut-legend-label">{item.name}</span>
            <span className="donut-legend-val">
              {item.value} ({Math.round((item.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

function AdminSpedytorDashboard() {
  const [stats, setStats] = useState<Stats>({});
  const [chartState, setChartState] = useState<"loading" | "empty" | "ready">(
    "loading",
  );
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const refTotal = useRef<HTMLSpanElement>(null);

  async function loadStats() {
    setChartState("loading");
    try {
      const res = await fetch("/api/backend/api/stats", {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data: Stats = await res.json();
      setStats(data);
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      if (total === 0) {
        setChartState("empty");
        return;
      }
      setChartState("ready");

      if (refTotal.current) animateCounter(refTotal.current, total);
    } catch {
      setChartState("empty");
    }
  }

  const [customPalette, setCustomPalette] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/backend/api/custom-categories", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const p: Record<string, string> = {};
          data.forEach((c: { name: string; color: string }) => (p[c.name] = c.color));
          setCustomPalette(p);
        }
      })
      .catch(() => { });
    loadStats();
  }, []);

  const entries = Object.entries(stats).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  function getSegments() {
    let offset = 0;
    return entries.slice(0, 4).map(([cat, val]) => {
      const arc = (val / total) * CIRCUMFERENCE;
      const gap = entries.length > 1 ? 4 : 0;
      const seg = {
        cat,
        val,
        color: colorFor(cat),
        dasharray: `${arc - gap} ${CIRCUMFERENCE - (arc - gap)}`,
        dashoffset: -offset,
      };
      offset += arc;
      return seg;
    });
  }

  const segments = chartState === "ready" ? getSegments() : [];

  const [apiUsage, setApiUsage] = useState("— / 24h");
  useEffect(() => {
    try {
      const usage = JSON.parse(
        localStorage.getItem("aiUsageTotal") ||
        '{"prompt_tokens":0,"completion_tokens":0}',
      );
      const t = usage.prompt_tokens + usage.completion_tokens;
      setApiUsage((t > 1000 ? (t / 1000).toFixed(1) + "k" : t) + " / 24h");
    } catch { }
  }, []);

  return (
    <>


      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: isDark ? "#0a0a0a" : "#f8fafc",
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
          {/* Top bar - Hidden on mobile if redundant with Sidebar hamburger */}
          <header
            className="mobile-top-bar"
            style={{
              height: 56,
              flexShrink: 0,
              background: isDark ? "#111111" : "#ffffff",
              borderBottom: `1px solid ${isDark ? "#252525" : "#e2e8f0"}`,
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 16,
              zIndex: 50
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isDark ? "#e8e8e8" : "#334155",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Dashboard Główny
              </h2>
            </div>
          </header>

          {/* Main content */}
          <main style={{ flex: 1, overflowY: "auto" }}>
            <div className="dash-main">
              {/* Header */}
              <header style={{ all: "unset", display: "block" }}>
                <h1 className="page-title-dash">Dashboard Główny</h1>
                <div className="status-dot-wrap">
                  <div className="pulse-ring" />
                  <span className="status-label">System Online</span>
                </div>
              </header>

              {/* Module cards */}
              <section className="modules-grid">
                <Link
                  href="/mail"
                  className="module-card gradient-purple purple"
                >
                  <div className="module-card-top">
                    <div className="module-icon">
                      <svg
                        width="28"
                        height="28"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className="module-badge">
                      {total > 0 ? `${total} Nowych` : "— Nowych"}
                    </span>
                  </div>
                  <h2 className="module-title">Poczta AI</h2>
                  <p className="module-desc">
                    Inteligentne sortowanie i analiza korespondencji
                    transportowej. System automatycznie wyodrębnia parametry
                    ładunków.
                  </p>
                  <span className="module-cta">
                    Otwórz moduł{" "}
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </Link>

                <Link href="/chat" className="module-card gradient-teal teal">
                  <div className="module-card-top">
                    <div className="module-icon">
                      <svg
                        width="28"
                        height="28"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <div className="module-badge module-badge-dot">
                      <span className="badge-active-dot" />
                      <span>Flota Online</span>
                    </div>
                  </div>
                  <h2 className="module-title">Komunikator</h2>
                  <p className="module-desc">
                    Asystent AI odpowiada na pytania, dobiera ładunki i prowadzi
                    przez formalności - wszystko w jednym oknie czatu.
                  </p>
                  <span className="module-cta">
                    Otwórz czat{" "}
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </Link>
              </section>

              {/* Stats + Chart */}
              <section className="insights-grid">
                <div className="stats-col">
                  <div className="stats-2col">
                    {Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, val]) => (
                      <StatCard
                        key={cat}
                        label={cat}
                        value={val}
                        total={total}
                        color={colorFor(cat, customPalette)}
                      />
                    ))}
                  </div>

                  <div className="total-base-card">
                    <p className="total-base-label">Łącznie w bazie</p>
                    <div className="total-base-row">
                      <span className="total-base-number" ref={refTotal}>
                        0
                      </span>
                      <span className="total-base-sublabel">
                        Zasoby zoptymalizowane przez AI
                      </span>
                    </div>
                    <span className="db-icon-bg">🗄</span>
                  </div>
                </div>

                {/* Chart Card */}
                <div className="chart-card glass-card">
                  <div className="chart-header">
                    <h3 className="chart-title">Podział Kategorii</h3>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      }}
                    >
                      <button
                        onClick={loadStats}
                        title="Odśwież"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: "var(--color-card-bg)",
                          border: "1px solid var(--color-card-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {chartState === "loading" && (
                    <div className="chart-body">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div className="spinner" />
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.15em",
                            color: "var(--color-text-muted)",
                            margin: 0,
                          }}
                        >
                          Ładowanie danych…
                        </p>
                      </div>
                    </div>
                  )}

                  {chartState === "empty" && (
                    <div className="chart-body">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <span style={{ fontSize: "2rem" }}>📭</span>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.15em",
                            color: "var(--color-text-muted)",
                            margin: 0,
                          }}
                        >
                          Brak danych
                        </p>
                      </div>
                    </div>
                  )}

                  {chartState === "ready" && (
                    <EfficiencyChart stats={stats} total={total} customPalette={customPalette} />
                  )}

                  <div className="chart-stats-row">
                    <div className="chart-stat-pill">
                      <span className="chart-stat-key">
                        Status Optymalizacji
                      </span>
                      <span className="chart-stat-val-primary">
                        EKSTREMALNY
                      </span>
                    </div>
                    <div className="chart-stat-pill">
                      <span className="chart-stat-key">Użycie API</span>
                      <span className="chart-stat-val">{apiUsage}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Access Footer */}
              <footer
                style={{ all: "unset", display: "block" }}
                className="quick-footer"
              >
                <label className="quick-label-dash">
                  Panel Szybkiego Dostępu
                </label>
                <div className="quick-grid">
                  <Link href="/mail?filter=OFERTA" className="quick-card">
                    Wykaz Ofert
                    <svg
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 7h.01M7 3h5l7 7-7 7H7a4 4 0 01-4-4V7a4 4 0 014-4z"
                      />
                    </svg>
                  </Link>
                  <Link href="/mail?filter=ZAMOWIENIE" className="quick-card">
                    Zamówienia
                    <svg
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7h13M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z"
                      />
                    </svg>
                  </Link>
                  <Link href="/mail?filter=FAKTURA" className="quick-card">
                    Rozliczenia
                    <svg
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                  </Link>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/docs`}
                    target="_blank"
                    className="quick-card"
                  >
                    Katalog API
                    <svg
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                  </a>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// KIEROWCA DASHBOARD
// ─────────────────────────────────────────────────────────────

interface DriverRouteStats {
  stats: Record<string, number>;
  recent_routes: {
    id: number;
    loading_city: string;
    unloading_city: string;
    weight_kg: number;
    price: number;
    status: string;
    assigned_at: string;
    assigned_by_email: string | null;
  }[];
  total: number;
}

const ROUTE_COLORS: Record<string, string> = {
  PRZYPISANE: "#f59e0b",   // amber
  "W DRODZE": "#3b82f6",   // blue
  ROZŁADOWANE: "#10b981",  // emerald
};

const ROUTE_GLOW: Record<string, string> = {
  PRZYPISANE: "rgba(56,189,248,0.35)",
  "W DRODZE": "rgba(99,102,241,0.35)",
  ROZŁADOWANE: "rgba(34,197,94,0.35)",
};



function DriverDashboard() {
  const { username } = useAuth();
  const [data, setData] = useState<DriverRouteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/backend/api/dashboard/driver-stats", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats = data?.stats ?? {};
  const total = data?.total ?? 0;
  const recent = data?.recent_routes ?? [];

  const statusStyle = (s: string) => ({
    color: ROUTE_COLORS[s] ?? "#94a3b8",
    background: `${ROUTE_COLORS[s] ?? "#94a3b8"}18`,
    border: `1px solid ${ROUTE_COLORS[s] ?? "#94a3b8"}44`,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Dzień dobry";
    if (h < 18) return "Dzień dobry";
    return "Dobry wieczór";
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: '"Inter", system-ui, sans-serif', background: isDark ? "#0a0a0a" : "#f8fafc" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar (ujednolicony) */}
        <header
          className="mobile-top-bar"
          style={{
            height: 56,
            flexShrink: 0,
            background: isDark ? "#111111" : "#ffffff",
            borderBottom: `1px solid ${isDark ? "#252525" : "#e2e8f0"}`,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 16,
            zIndex: 50
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#e8e8e8" : "#334155", margin: 0 }}>Dashboard Kierowcy</h2>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto" }}>
          <div className="dash-main">
            {/* Header sekcja */}
            <header style={{ all: "unset", display: "block" }}>
              <h1 className="page-title-dash">{greeting()}, {username} 👋</h1>
              <div className="status-dot-wrap">
                <div className="pulse-ring" />
                <span className="status-label">Panel Kierowcy — SmartLoad AI</span>
              </div>
            </header>

            {loading ? (
              <div className="chart-body">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                  <div className="spinner" />
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-text-muted)" }}>Ładowanie danych…</p>
                </div>
              </div>
            ) : (
              <>
                <section className="insights-grid">
                  {/* Stat kafelki */}
                  <div className="stats-col">
                    <div className="stats-2col">
                      {Object.entries(ROUTE_COLORS).map(([cat, color]) => (
                        <StatCard
                          key={cat}
                          label={cat}
                          value={stats[cat] ?? 0}
                          total={total}
                          color={color}
                        />
                      ))}
                    </div>

                    <div className="total-base-card">
                      <p className="total-base-label">Wszystkie Trasy</p>
                      <div className="total-base-row">
                        <span className="total-base-number">{total}</span>
                        <span className="total-base-sublabel">Łączna liczba zleceń przypisanych do Ciebie</span>
                      </div>
                      <span className="db-icon-bg">🚛</span>
                    </div>
                  </div>

                  {/* Chart Card */}
                  <div className="chart-card glass-card">
                    <div className="chart-header">
                      <h3 className="chart-title">Status Twoich Tras</h3>
                    </div>
                    {total === 0 ? (
                      <div className="chart-body">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ fontSize: "2rem" }}>📭</span>
                          <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-text-muted)", margin: 0 }}>
                            Brak danych
                          </p>
                        </div>
                      </div>
                    ) : (
                      <EfficiencyChart stats={stats} total={total} customPalette={ROUTE_COLORS} />
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// ROOT EXPORT — warunkowe renderowanie
// ─────────────────────────────────────────────────────────────
function DashboardStyles() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        :root {
          --font-headline: 'Space Grotesk', sans-serif;
          --color-primary: #0035c5;
          --color-tertiary-dim: #00daf3;
          --color-card-bg: rgba(255,255,255,0.85);
          --color-card-border: rgba(255,255,255,0.2);
          --color-outline-variant-alpha: rgba(196,197,218,0.15);
          --color-text-primary: #0f172a;
          --color-text-muted: #64748b;
          --color-text-faint: #94a3b8;
          --color-progress-bg: #e2e8f0;
        }
        .dark {
          --color-card-bg: rgba(15,23,42,0.7);
          --color-card-border: rgba(255,255,255,0.05);
          --color-outline-variant-alpha: rgba(255,255,255,0.08);
          --color-text-primary: #f1f5f9;
          --color-text-muted: #94a3b8;
          --color-text-faint: #475569;
          --color-progress-bg: #1e293b;
        }
        .glass-card { background: var(--color-card-bg); backdrop-filter: blur(24px); border: 1px solid var(--color-card-border); }
        .gradient-purple { background: linear-gradient(135deg, #6b21a8 0%, #3b0764 100%); }
        .gradient-teal { background: linear-gradient(135deg, #0f766e 0%, #134e4a 100%); }
        .dash-main { display:flex; flex-direction:column; gap:2.5rem; padding:3rem; overflow-y:auto; flex:1; }
        .page-title-dash { font-family:var(--font-headline); font-size:clamp(28px,3vw,40px); font-weight:700; letter-spacing:-0.04em; color:var(--color-text-primary); margin-bottom:0.5rem; }
        .status-dot-wrap { display:flex; align-items:center; gap:0.75rem; }
        .pulse-ring { position:relative; width:8px; height:8px; flex-shrink:0; }
        .pulse-ring::before { content:""; position:absolute; inset:0; border-radius:50%; background:var(--color-tertiary-dim); opacity:0.75; animation:ping 1.5s ease-in-out infinite; }
        .pulse-ring::after { content:""; position:absolute; inset:0; border-radius:50%; background:var(--color-tertiary-dim); }
        @keyframes ping { 0%{transform:scale(1);opacity:0.75;} 75%,100%{transform:scale(2.2);opacity:0;} }
        .status-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; color:var(--color-primary); }
        .modules-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:2rem; }
        .module-card { position:relative; overflow:hidden; border-radius:8px; padding:2rem; color:#fff; cursor:pointer; text-decoration:none; display:block; transition:transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s; }
        .module-card:hover { transform:translateY(-5px); }
        .module-card.purple { box-shadow:0 20px 60px rgba(107,33,168,0.3); }
        .module-card.purple:hover { box-shadow:0 28px 80px rgba(107,33,168,0.4); }
        .module-card.teal { box-shadow:0 20px 60px rgba(15,118,110,0.3); }
        .module-card.teal:hover { box-shadow:0 28px 80px rgba(15,118,110,0.4); }
        .module-card-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2.5rem; }
        .module-icon { width:56px; height:56px; border-radius:8px; background:rgba(255,255,255,0.12); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; }
        .module-badge { padding:4px 12px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.1); border-radius:100px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; }
        .module-badge-dot { display:flex; align-items:center; gap:6px; }
        .badge-active-dot { width:6px; height:6px; border-radius:50%; background:var(--color-tertiary-dim); }
        .module-title { font-family:var(--font-headline); font-size:30px; font-weight:700; letter-spacing:-0.03em; margin-bottom:0.75rem; }
        .module-desc { color:rgba(255,255,255,0.65); font-size:13px; line-height:1.65; max-width:340px; margin-bottom:2.5rem; }
        .module-cta { display:inline-flex; align-items:center; gap:0.75rem; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; transition:gap 0.2s; color:#fff; text-decoration:none; }
        .module-card:hover .module-cta { gap:1.25rem; }
        .insights-grid { display:grid; grid-template-columns:5fr 7fr; gap:2rem; align-items:stretch; }
        .stats-col { display:flex; flex-direction:column; gap:1.5rem; }
        .stats-2col { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
        .stat-card { border-radius:8px; padding:1.5rem; background:var(--color-card-bg); backdrop-filter:blur(24px); border:1px solid var(--color-card-border); transition:border-color 0.2s; }
        .stat-card:hover { border-color:rgba(0,53,197,0.3); }
        .stat-label-dash { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; color:var(--color-text-muted); margin-bottom:1rem; }
        .stat-value-row { display:flex; align-items:baseline; gap:0.5rem; }
        .stat-number-dash { font-family:var(--font-headline); font-size:48px; font-weight:700; color:var(--color-text-primary); line-height:1; }
        .stat-trend-pos { font-size:10px; font-weight:700; color:#22c55e; }
        .stat-trend-new { font-size:10px; font-weight:700; color:var(--color-primary); }
        .stat-progress { margin-top:1rem; width:100%; height:3px; background:var(--color-progress-bg); border-radius:100px; overflow:hidden; }
        .stat-bar { height:100%; border-radius:100px; transition:width 1s cubic-bezier(0.16,1,0.3,1); width:0%; }
        .bar-primary { background:var(--color-primary); }
        .bar-tertiary { background:var(--color-tertiary-dim); }
        .bar-violet { background:#8b5cf6; }
        .bar-slate { background:#64748b; }
        .total-base-card { border-radius:8px; padding:2rem; background:color-mix(in oklch, var(--color-primary) 8%, transparent); border:1px solid color-mix(in oklch, var(--color-primary) 25%, transparent); position:relative; overflow:hidden; }
        .total-base-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; color:var(--color-primary); margin-bottom:0.5rem; }
        .total-base-row { display:flex; align-items:baseline; gap:1rem; }
        .total-base-number { font-family:var(--font-headline); font-size:64px; font-weight:700; color:var(--color-text-primary); line-height:1; letter-spacing:-0.04em; }
        .total-base-sublabel { font-size:12px; color:var(--color-text-muted); font-weight:500; }
        .db-icon-bg { position:absolute; right:-24px; bottom:-24px; opacity:0.1; transition:transform 0.7s ease; font-size:120px; color:var(--color-primary); cursor:default; user-select:none; }        .total-base-card:hover .db-icon-bg { transform:rotate(-12deg); }
        .chart-card { border-radius:8px; padding:2.5rem; display:flex; flex-direction:column; }
        .chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:2.5rem; }
        .chart-title { font-family:var(--font-headline); font-size:22px; font-weight:700; color:var(--color-text-primary); letter-spacing:-0.02em; }
        .chart-body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300px; position:relative; }
        .donut-wrapper { position:relative; width:260px; height:260px; margin:0 auto; }
        .donut-svg { transform:rotate(-90deg); }
        .donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .donut-pct { font-family:var(--font-headline); font-size:44px; font-weight:700; color:var(--color-text-primary); line-height:1; }
        .donut-sublabel { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.2em; color:var(--color-text-muted); margin-top:4px; }
        .donut-seg { transition:stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1); }
        .donut-legend { display:flex; flex-wrap:wrap; justify-content:center; gap:1rem 1.5rem; margin-top:1.5rem; width:100%; }
        .donut-legend-item { display:flex; align-items:center; gap:6px; }
        .donut-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .donut-legend-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--color-text-muted); }
        .donut-legend-val { font-size:10px; font-weight:700; color:var(--color-text-primary); margin-left:2px; }
        .chart-stats-row { margin-top:2rem; width:100%; display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
        .chart-stat-pill { padding:1rem; border:1px solid var(--color-outline-variant-alpha); border-radius:8px; display:flex; align-items:center; justify-content:space-between; }
        .chart-stat-key { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--color-text-muted); }
        .chart-stat-val-primary { font-size:13px; font-weight:700; color:var(--color-primary); }
        .chart-stat-val { font-size:13px; font-weight:700; color:var(--color-text-primary); }
        .legend-item { display:flex; align-items:center; gap:6px; }
        .legend-dot { width:8px; height:8px; border-radius:50%; }
        .legend-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:var(--color-text-muted); }
        .quick-footer { padding-top:2.5rem; border-top:1px solid var(--color-outline-variant-alpha); }
        .quick-label-dash { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.3em; color:var(--color-text-faint); margin-bottom:1.5rem; display:block; }
        .quick-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1.5rem; }
        .quick-card { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; border-radius:8px; background:var(--color-card-bg); backdrop-filter:blur(24px); border:1px solid var(--color-card-border); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--color-text-primary); text-decoration:none; transition:background 0.2s, color 0.2s, transform 0.15s, border-color 0.2s; }
        .quick-card:hover { background:var(--color-primary); color:#fff; border-color:var(--color-primary); transform:scale(1.02); }
        .spinner { width:32px; height:32px; border:2px solid var(--color-primary); border-top-color:transparent; border-radius:50%; animation:spin 0.7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width: 1024px) {
          .dash-main { padding: 1.5rem; gap: 2rem; }
          .modules-grid { grid-template-columns: 1fr !important; gap: 1.5rem; }
          .insights-grid { grid-template-columns: 1fr !important; }
          .stats-2col { grid-template-columns: 1fr 1fr !important; gap: 0.75rem; }
          .chart-body { min-height: auto; }
          .donut-legend { grid-template-columns: 1fr !important; width: 100% !important; margin-top: 2rem; }
          .quick-grid { grid-template-columns: 1fr !important; gap: 1rem; }
          .total-base-number { font-size: 48px; }
          .chart-stats-row { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .dash-main { padding: 1rem; gap: 1.5rem; padding-top: 3.5rem; }
          .stat-number-dash { font-size: 32px; }
          .total-base-number { font-size: 40px; }
          .module-title { font-size: 24px; }
          .module-desc { font-size: 12px; }
        }

        /* --- Efficiency Chart Styles --- */
        .chart-container { display: flex; flex-direction: column; align-items: center; gap: 2rem; }
        .chart-visual { position: relative; width: 300px; height: 300px; }
        .donut-chart { transform: rotate(0deg); }
        .chart-bg { fill: none; stroke: var(--color-progress-bg); }
        .chart-segment { fill: none; stroke-linecap: round; transition: stroke-dashoffset 0.5s ease; }
        .chart-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--color-text-primary); pointer-events: none; }
        .chart-percentage { font-family: var(--font-headline); font-size: 54px; font-weight: 700; margin: 0; line-height: 1; }
        .chart-label { font-size: 12px; font-weight: 700; color: var(--color-text-muted); margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 0.2em; }
        .chart-legend-row { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; }
        .chart-legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
        .chart-legend-item .dot { width: 10px; height: 10px; border-radius: 50%; }
        .chart-legend-item .name { text-transform: uppercase; }
        .chart-legend-item .value { color: var(--color-text-muted); }
        @media (max-width: 900px) {
          .mobile-top-bar { display: none !important; }
        }
      `}</style>
  );
}

export default function DashboardPage() {
  const { role } = useAuth();

  return (
    <>
      <DashboardStyles />
      {role === "KIEROWCA" ? <DriverDashboard /> : <AdminSpedytorDashboard />}
    </>
  );
}
