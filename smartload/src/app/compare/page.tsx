"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

interface Offer {
  id: string;
  price: number;
  currency: string;
  weight?: number;
  source?: string;
  origin?: string;
  destination?: string;
}

interface CompareData {
  chat_response?: string;
  ui_data?: {
    timocom_list: Offer[];
    internal_list: Offer[];
  };
}

export default function ComparePage() {
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState<"initial" | "loading" | "results">("initial");
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !fromCity.trim() || !toCity.trim()) return;

    setIsLoading(true);
    setViewState("loading");
    setError(null);

    try {
      const url = `/api/exchange/compare?from_city=${encodeURIComponent(fromCity)}&to_city=${encodeURIComponent(toCity)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Błąd serwera (HTTP ${res.status})`);
      }

      const result = await res.json();
      setData(result);
      setViewState("results");
    } catch (err: any) {
      console.error("Compare error:", err);
      setError(err.message || "Nie udało się pobrać danych. Spróbuj ponownie.");
      setViewState("initial");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price == null) return "—";
    return Number(price).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getBestId = (list: Offer[]) => {
    if (!list || list.length === 0) return null;
    return list.reduce((best, cur) => (cur.price > best.price ? cur : best), list[0]).id;
  };

  return (
    <>
      <style>{`
        :root {
          --font-headline: "Space Grotesk", sans-serif;
        }

        .compare-form {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .compare-field {
          flex: 1;
          min-width: 200px;
        }

        .compare-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #64748b;
          margin-bottom: 8px;
        }

        .dark .compare-label {
          color: #94a3b8;
        }

        .compare-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s;
        }

        .dark .compare-input {
          border-color: #252525;
          background: #191919;
          color: #e8e8e8;
        }

        .compare-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .dark .compare-input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .dark .input-icon {
          color: #555;
        }

        .btn-compare {
          padding: 0.75rem 2rem;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.25s;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          min-height: 46px;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
        }

        .btn-compare:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(59, 130, 246, 0.45);
        }

        .btn-compare:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-panel {
          border-radius: 12px;
          padding: 1.5rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(99, 102, 241, 0.06) 100%);
          border: 1px solid rgba(59, 130, 246, 0.15);
          animation: slideUp 0.4s ease;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .dark .ai-panel {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .ai-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
        }

        .ai-text {
          font-size: 14px;
          line-height: 1.7;
          color: #334155;
          flex: 1;
        }

        .dark .ai-text {
          color: #cbd5e1;
        }

        .ai-badge {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #6366f1;
          margin-bottom: 4px;
        }

        .dark .ai-badge {
          color: #818cf8;
        }

        .compare-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .compare-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .column-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 12px;
          border-bottom: 2px solid;
        }

        .column-header.timo { border-color: #3b82f6; }
        .column-header.internal { border-color: #8b5cf6; }

        .column-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .column-icon.timo {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .column-icon.internal {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .column-title {
          font-family: var(--font-headline);
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .dark .column-title { color: #f1f5f9; }

        .column-count {
          margin-left: auto;
          font-size: 11px;
          font-weight: 700;
          border-radius: 100px;
          padding: 3px 10px;
        }

        .column-count.timo { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .dark .column-count.timo { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .column-count.internal { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        .dark .column-count.internal { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }

        .offer-card {
          border-radius: 10px;
          padding: 1.25rem;
          background: #fff;
          border: 1px solid #e2e8f0;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .dark .offer-card { background: #191919; border-color: #252525; }

        .offer-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .dark .offer-card:hover {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          border-color: #333;
        }

        .offer-card.best { border-width: 2px; }
        .offer-card.best.timo {
          border-color: #3b82f6;
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.03) 0%, transparent 100%);
        }
        .dark .offer-card.best.timo {
          border-color: #2563eb;
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.06) 0%, #191919 100%);
        }

        .offer-card.best.internal {
          border-color: #8b5cf6;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%);
        }
        .dark .offer-card.best.internal {
          border-color: #7c3aed;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.06) 0%, #191919 100%);
        }

        .best-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          padding: 3px 8px;
          border-radius: 100px;
          color: #fff;
        }
        .best-badge.timo { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .best-badge.internal { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

        .offer-price-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 10px; }
        .offer-price { font-family: var(--font-headline); font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em; }
        .dark .offer-price { color: #f1f5f9; }
        .offer-currency { font-size: 14px; font-weight: 700; color: #64748b; }
        .dark .offer-currency { color: #94a3b8; }

        .offer-details { display: flex; flex-wrap: wrap; gap: 8px; }
        .offer-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; color: #475569; }
        .dark .offer-chip { background: #111; color: #94a3b8; }

        .offer-source-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; display: inline-block; }
        .offer-source-tag.timo { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .dark .offer-source-tag.timo { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .offer-source-tag.internal { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        .dark .offer-source-tag.internal { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }

        .column-empty { padding: 2rem; text-align: center; border-radius: 10px; border: 1px dashed #e2e8f0; color: #94a3b8; font-size: 13px; font-weight: 500; }
        .dark .column-empty { border-color: #252525; color: #555; }

        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
        .dark .skeleton { background: linear-gradient(90deg, #1e1e1e 25%, #2a2a2a 50%, #1e1e1e 75%); background-size: 200% 100%; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .skel-card { height: 120px; border-radius: 10px; margin-bottom: 0.75rem; }
        .skel-ai { height: 80px; border-radius: 12px; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .anim-slide { animation: slideUp 0.4s ease both; }

        .compare-hero { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; gap: 1rem; }
        .hero-icon { width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1)); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
        .dark .hero-icon { background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15)); }
        .hero-title { font-family: var(--font-headline); font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
        .dark .hero-title { color: #f1f5f9; }
        .hero-desc { font-size: 13px; color: #64748b; max-width: 400px; line-height: 1.7; }
        .dark .hero-desc { color: #888; }

        .error-box { border-radius: 10px; padding: 1rem 1.25rem; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); color: #dc2626; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; animation: slideUp 0.3s ease; }
        .dark .error-box { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); color: #f87171; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        /* Dashboard layout specific */
        .page-container { display: flex; height: 100vh; overflow: hidden; background: #f8fafc; }
        .dark .page-container { background: #0a0a0a; }

        @media (max-width: 768px) {
          .compare-columns { grid-template-columns: 1fr; }
          .compare-form { flex-direction: column; }
          .compare-field { min-width: unset; }
          .btn-compare { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="page-container" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
        <Sidebar />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Top Bar */}
          <header style={{
            height: 56,
            flexShrink: 0,
            background: isDark ? "#111111" : "#ffffff",
            borderBottom: `1px solid ${isDark ? "#252525" : "#e2e8f0"}`,
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#e8e8e8" : "#334155", margin: 0 }}>
                Porównywarka Frachtu
              </h2>
              <p style={{ fontSize: 12, color: isDark ? "#888888" : "#94a3b8", margin: 0 }}>
                Zestawienie ofert TimoCom i bazy wewnętrznej
              </p>
            </div>
            <div style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: isDark ? "rgba(139,92,246,0.2)" : "#f5f3ff",
              color: isDark ? "#a78bfa" : "#7c3aed",
              border: `1px solid ${isDark ? "rgba(139,92,246,0.3)" : "#ddd6fe"}`,
              fontWeight: 500,
            }}>
              ✨ Smart Selection
            </div>
          </header>

          <main style={{ flex: 1, overflowY: "auto", padding: "2rem 3rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
              
              {/* Header section */}
              <div>
                <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 700, letterSpacing: "-0.04em", color: isDark ? "#f1f5f9" : "#0f172a", margin: "0 0 4px 0" }}>
                  Porównywarka Frachtu
                </h1>
                <p style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", margin: 0 }}>
                  Zestawiaj oferty z giełdy TimoCom z Twoją bazą wewnętrzną — AI doradzi najlepszy wybór
                </p>
              </div>

              {/* Search Form */}
              <div className="glass-card" style={{
                borderRadius: 12,
                padding: "1.5rem",
                background: isDark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)",
                backdropFilter: "blur(24px)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`
              }}>
                <form className="compare-form" onSubmit={handleCompare}>
                  <div className="compare-field">
                    <label className="compare-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><circle cx="12" cy="12" r="10"/></svg>
                      Miasto załadunku
                    </label>
                    <div className="input-wrap">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <input
                        type="text"
                        className="compare-input"
                        placeholder="np. Warszawa, Kraków..."
                        required
                        value={fromCity}
                        onChange={(e) => setFromCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="compare-field">
                    <label className="compare-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                      Miasto rozładunku
                    </label>
                    <div className="input-wrap">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <input
                        type="text"
                        className="compare-input"
                        placeholder="np. Berlin, Hamburg..."
                        required
                        value={toCity}
                        onChange={(e) => setToCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="btn-compare">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        Szukam…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Porównaj
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Error Box */}
              {error && (
                <div className="error-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{error}</span>
                </div>
              )}

              {/* AI Panel */}
              {viewState === "results" && data?.chat_response && (
                <div className="ai-panel">
                  <div className="ai-avatar">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16v2M16 16v2"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ai-badge">Asystent SmartLoad AI</div>
                    <div className="ai-text">{data.chat_response}</div>
                  </div>
                </div>
              )}

              {/* Loading Skeleton */}
              {viewState === "loading" && (
                <div>
                  <div className="skeleton skel-ai" style={{ marginBottom: "1rem" }}></div>
                  <div className="compare-columns">
                    <div>
                      <div className="skeleton" style={{ height: 40, marginBottom: "0.75rem" }}></div>
                      <div className="skeleton skel-card"></div>
                      <div className="skeleton skel-card"></div>
                    </div>
                    <div>
                      <div className="skeleton" style={{ height: 40, marginBottom: "0.75rem" }}></div>
                      <div className="skeleton skel-card"></div>
                      <div className="skeleton skel-card"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Initial State / Hero */}
              {viewState === "initial" && !error && (
                <div className="compare-hero">
                  <div className="hero-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M16 16s3-3 3-8V4h-7v4h-3V4H2v4c0 5 3 8 3 8"/><path d="M7 16v4h10v-4"/><path d="M12 8v8"/></svg>
                  </div>
                  <div className="hero-title">Wyszukaj trasę do porównania</div>
                  <div className="hero-desc">
                    Wprowadź miasta załadunku i rozładunku powyżej. System przeszuka giełdę TimoCom oraz bazą wewnętrzną i zaproponuje najlepszą ofertę.
                  </div>
                </div>
              )}

              {/* Results Panel */}
              {viewState === "results" && data?.ui_data && (
                <div className="compare-columns">
                  
                  {/* TimoCom */}
                  <div className="compare-column">
                    <div className="column-header timo">
                      <div className="column-icon timo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/></svg>
                      </div>
                      <div>
                        <div className="column-title">Giełda TimoCom</div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>Oferty z rynku spot</div>
                      </div>
                      <span className="column-count timo">{data.ui_data.timocom_list.length}</span>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {data.ui_data.timocom_list.length === 0 ? (
                        <div className="column-empty">
                          Brak ofert na tej trasie
                        </div>
                      ) : (
                        data.ui_data.timocom_list.map((offer) => (
                          <OfferCard 
                            key={offer.id} 
                            offer={offer} 
                            type="timo" 
                            isBest={offer.id === getBestId(data.ui_data!.timocom_list)} 
                            formatPrice={formatPrice}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Internal */}
                  <div className="compare-column">
                    <div className="column-header internal">
                      <div className="column-icon internal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      </div>
                      <div>
                        <div className="column-title">Baza Wewnętrzna</div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>Oferty z maili i scraperów</div>
                      </div>
                      <span className="column-count internal">{data.ui_data.internal_list.length}</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {data.ui_data.internal_list.length === 0 ? (
                        <div className="column-empty">
                          Brak ofert na tej trasie
                        </div>
                      ) : (
                        data.ui_data.internal_list.map((offer) => (
                          <OfferCard 
                            key={offer.id} 
                            offer={offer} 
                            type="internal" 
                            isBest={offer.id === getBestId(data.ui_data!.internal_list)} 
                            formatPrice={formatPrice}
                          />
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </>
  );
}

function OfferCard({ offer, type, isBest, formatPrice }: { 
  offer: Offer, 
  type: "timo" | "internal", 
  isBest: boolean,
  formatPrice: (p: number) => string 
}) {
  return (
    <div className={`offer-card ${isBest ? "best " + type : ""} anim-slide`}>
      {isBest && <span className={`best-badge ${type}`}>★ Najlepsza</span>}
      <div className={`offer-source-tag ${type}`}>{offer.source || type.toUpperCase()}</div>
      <div className="offer-price-row">
        <span className="offer-price">{formatPrice(offer.price)}</span>
        <span className="offer-currency">{offer.currency || "EUR"}</span>
      </div>
      <div className="offer-details">
        <span className="offer-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polyline points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          {offer.weight ? `${offer.weight} t` : "—"}
        </span>
        <span className="offer-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          {offer.origin || "?"} → {offer.destination || "?"}
        </span>
      </div>
    </div>
  );
}
