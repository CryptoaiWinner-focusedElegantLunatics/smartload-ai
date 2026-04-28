"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense, useMemo, memo } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "../components/Sidebar";
import DOMPurify from "dompurify";

const DEFAULT_CATS = ["OFERTA", "ZAMOWIENIE", "FAKTURA", "DOKUMENT_CMR", "INNE"];

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  OFERTA: { bg: "#1d4ed8", text: "#fff" },
  ZAMOWIENIE: { bg: "#059669", text: "#fff" },
  FAKTURA: { bg: "#7c3aed", text: "#fff" },
  INNE: { bg: "#475569", text: "#fff" },
  DOKUMENT_CMR: { bg: "#d97706", text: "#fff" },
};

const HASH_PALETTE = [
  { bg: "#db2777", text: "#fff" }, { bg: "#0891b2", text: "#fff" },
  { bg: "#4f46e5", text: "#fff" }, { bg: "#b45309", text: "#fff" },
  { bg: "#15803d", text: "#fff" }, { bg: "#0f766e", text: "#fff" },
  { bg: "#9333ea", text: "#fff" }, { bg: "#c2410c", text: "#fff" },
];

function getCatColor(cat: string, customCats: { name: string; color: string }[] = []) {
  const custom = customCats.find(c => c.name === cat);
  if (custom) return { bg: custom.color, text: "#fff" };
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return HASH_PALETTE[Math.abs(hash) % HASH_PALETTE.length];
}

function fmtWeight(w: number | null | undefined) {
  return w != null ? (w / 1000).toFixed(1) + " t" : "—";
}
function fmtPrice(p: number | null | undefined, currency = "EUR") {
  return p != null ? Number(p).toLocaleString("pl-PL") + " " + currency : "—";
}

function CatPill({ cat, small = false, customCats }: { cat: string; small?: boolean; customCats: any[] }) {
  const { bg, text } = getCatColor(cat, customCats);
  return (
    <span style={{ display: "inline-block", padding: small ? "2px 8px" : "3px 12px", borderRadius: 100, fontSize: small ? 10 : 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: bg, color: text, border: `1px solid ${bg}` }}>
      {cat}
    </span>
  );
}

// ── OPTIMIZATION: Memoized Email Row ──
const EmailRow = memo(({ e, idx, sel, isUnread, isStarred, isDark, cBorder, cGreen, cFaint, cPrimary, cText, deleteMode, toggleSelect, toggleStar, markRead, setModal, customCats, openDropdown, setOpenDropdown, reclassify, allCats, setCatModal, onDeleteOne }: any) => {
  const route = (e.loading_city && e.unloading_city) ? `${e.loading_city} → ${e.unloading_city}` : "—";
  const weight = fmtWeight(e.weight_kg);
  const price = fmtPrice(e.price, e.currency);

  return (
    <div
      className="email-row"
      onClick={() => deleteMode ? toggleSelect(e.id, idx, !sel, false) : (markRead(e.id), setModal(e))}
      style={{
        display: "grid",
        gridTemplateColumns: deleteMode ? "45px 30px 130px 1fr 120px 60px 75px 75px 120px 75px 30px" : "30px 130px 1fr 120px 60px 75px 75px 120px 75px 30px",
        gap: "18px",
        padding: "0.9rem 1.5rem",
        borderBottom: `1px solid ${cBorder}`,
        background: sel ? (isDark ? "rgba(59,130,246,0.1)" : "#f0f7ff") : "transparent",
        cursor: "pointer",
        alignItems: "center",
        transition: "all 0.15s"
      }}
    >
      {deleteMode && (
        <div style={{ display: "flex", justifyContent: "center" }} onClick={ev => ev.stopPropagation()}>
          <input type="checkbox" checked={sel} onChange={ev => toggleSelect(e.id, idx, ev.target.checked, (ev.nativeEvent as any).shiftKey)} style={{ cursor: "pointer" }} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center" }} onClick={ev => toggleStar(e.id, ev)}>
        <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: isStarred ? "#f59e0b" : cFaint, transition: "transform 0.1s" }} onMouseEnter={el => el.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={el => el.currentTarget.style.transform = "scale(1)"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        </button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#fff" : "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {e.sender?.split("<")[0].trim() || e.sender || "—"}
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? "#aaa" : "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {e.subject || "(brak tematu)"}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? "#eee" : "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {route}
      </div>

      <div style={{ fontSize: 12, color: cFaint }}>
        {weight}
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: "#22c55e" }}>
        {price}
      </div>

      <div>
        <CatPill cat={e.ai_category || "INNE"} customCats={customCats} />
      </div>

      <div /> {/* Spacer to push columns left */}

      <div className="popraw-dropdown-wrap" style={{ position: "relative" }} onClick={ev => ev.stopPropagation()}>
        <button
          onClick={() => setOpenDropdown(openDropdown === e.id ? null : e.id)}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            background: isDark ? "#1a1a1a" : "#fff",
            border: `1px solid ${cBorder}`,
            color: cText,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "all 0.1s"
          }}
          onMouseEnter={el => el.currentTarget.style.borderColor = cPrimary}
          onMouseLeave={el => el.currentTarget.style.borderColor = cBorder}
        >
          Popraw
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: openDropdown === e.id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.1s" }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {openDropdown === e.id && (
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, width: 180, background: isDark ? "#111" : "#fff", border: `1px solid ${cBorder}`, borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", zIndex: 100, padding: 6, backdropFilter: "blur(10px)", animation: "fadeInUp 0.15s ease-out" }}>
            <div style={{ padding: "8px 12px", fontSize: 9, fontWeight: 800, color: cFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Zmień kategorię</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {allCats.map((c: string) => (
                <button key={c} onClick={() => { reclassify(e.id, c); setOpenDropdown(null); }} style={{ display: "flex", alignItems: "center", width: "100%", padding: "0.4rem 0.75rem", border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", gap: "0.5rem", transition: "background 0.2s" }} onMouseEnter={(el) => el.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9"} onMouseLeave={(el) => el.currentTarget.style.background = "transparent"}>
                  <CatPill cat={c} small customCats={customCats} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }} onClick={ev => { ev.stopPropagation(); onDeleteOne(); }}>
        <button style={{ background: "transparent", border: "none", color: cFaint, cursor: "pointer", padding: 6, borderRadius: 6, transition: "all 0.1s" }} onMouseEnter={el => { el.currentTarget.style.color = "#ef4444"; el.currentTarget.style.background = "rgba(239,68,68,0.1)"; }} onMouseLeave={el => { el.currentTarget.style.color = cFaint; el.currentTarget.style.background = "transparent"; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
        </button>
      </div>
    </div>
  );
});

// ── OPTIMIZATION: Memoized Mobile Email Card ──
const MobileEmailCard = memo(({ e, idx, sel, isUnread, isStarred, isDark, cBorder, cFaint, cPrimary, cText, cGreen, cMuted, deleteMode, toggleSelect, toggleStar, markRead, setModal, customCats, openDropdown, setOpenDropdown, reclassify, allCats, setCatModal, onDeleteOne }: any) => {
  const cat = e.ai_category || "INNE";
  const routeStart = e.loading_city || "?";
  const routeEnd = e.unloading_city || "?";
  const weight = fmtWeight(e.weight_kg);
  const price = fmtPrice(e.price, e.currency);

  return (
    <div
      className="mail-card"
      onClick={() => deleteMode ? toggleSelect(e.id, idx, !sel, false) : (markRead(e.id), setModal(e))}
      style={{
        background: isDark ? "#111" : "#fff",
        border: `1px solid ${sel ? cPrimary : cBorder}`,
        borderLeft: `3px solid ${isUnread ? cPrimary : "transparent"}`,
        borderRadius: 12,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.05)",
        position: "relative",
        cursor: "pointer"
      }}
    >
      {/* Header: Star, Info, Category */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <div style={{ flexShrink: 0, marginTop: 1 }} onClick={ev => toggleStar(e.id, ev)}>
            <button style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: isStarred ? "#f59e0b" : cFaint }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: cPrimary, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.sender?.split("<")[0].trim() || e.sender || "—"}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: cFaint, marginTop: 1 }}>
              {new Date(e.date).toLocaleDateString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#e8e8e8" : "#0f172a", lineHeight: 1.4, marginTop: 2 }}>
              {e.subject || "(brak tematu)"}
            </div>
          </div>
        </div>
        <CatPill cat={cat} customCats={customCats} />
      </div>

      {/* Route Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: isDark ? "#0a0a0a" : "#f8fafc", borderRadius: 7, padding: "0.5rem 0.75rem" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: cFaint, marginBottom: 2 }}>Start</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#e8e8e8" : "#0f172a" }}>{routeStart}</div>
        </div>
        <div style={{ color: cFaint, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M17 8l4 4-4 4M3 12h18" />
          </svg>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: cFaint, marginBottom: 2 }}>Koniec</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#e8e8e8" : "#0f172a" }}>{routeEnd}</div>
        </div>
      </div>

      {/* Footer: Data & Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: cFaint }}>Waga</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#e8e8e8" : "#0f172a" }}>{weight}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: cFaint }}>Stawka</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: cGreen }}>{price}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <div className="popraw-dropdown-wrap" style={{ position: "relative", display: "inline-flex" }} onClick={ev => ev.stopPropagation()}>
            <button
              onClick={() => setOpenDropdown(openDropdown === e.id ? null : e.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0.3rem 0.625rem", borderRadius: 6, border: `1px solid ${cBorder}`, background: isDark ? "#111" : "#fff", fontSize: 11, fontWeight: 600, color: cMuted, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Popraw AI <span style={{ fontSize: 9 }}>▾</span>
            </button>
            {openDropdown === e.id && (
              <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 8, width: 180, background: isDark ? "#111" : "#fff", border: `1px solid ${cBorder}`, borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", zIndex: 100, padding: 6, backdropFilter: "blur(10px)" }}>
                <div style={{ padding: "8px 12px", fontSize: 9, fontWeight: 800, color: cFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Zmień kategorię</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {allCats.map((c: string) => (
                    <button key={c} onClick={() => { reclassify(e.id, c); setOpenDropdown(null); }} style={{ display: "flex", alignItems: "center", width: "100%", padding: "0.4rem 0.75rem", border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", gap: "0.5rem" }}>
                      <CatPill cat={c} small customCats={customCats} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={ev => { ev.stopPropagation(); onDeleteOne(); }}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: `1px solid ${cBorder}`, background: "transparent", color: cFaint, cursor: "pointer" }}
            onMouseEnter={el => el.currentTarget.style.color = "#ef4444"}
            onMouseLeave={el => el.currentTarget.style.color = cFaint}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

// ── OPTIMIZATION: Separate Modal Component to isolate state ──
const AddCategoryModal = ({ isOpen, onClose, onSave, cSurface, cBorder, cText, cHover, cMuted, cFaint, cBg, cPrimary, isDark }: any) => {
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatColor, setNewCatColor] = useState("#64748b");
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: cSurface, border: `1px solid ${cBorder}`, borderRadius: 12, width: "100%", maxWidth: 380, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", margin: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: `1px solid ${cBorder}` }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: cText }}>Dodaj kategorię AI</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${cBorder}`, background: cHover, color: cMuted, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <label style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: cFaint, display: "block", marginBottom: 8 }}>Nazwa kategorii (np. REKLAMACJA)</label>
          <input autoFocus type="text" placeholder="WPISZ_NAZWE" maxLength={25} value={newCatInput} onChange={(e) => setNewCatInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") onSave(newCatInput, newCatColor); }} style={{ width: "100%", padding: "0.6rem 0.875rem", border: `1px solid ${cBorder}`, borderRadius: 8, background: cBg, color: cText, fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", outline: "none", boxSizing: "border-box", marginBottom: "1rem" }} />
          <label style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: cFaint, display: "block", marginBottom: 8 }}>Kolor kategorii</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
            {["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#7c3aed", "#ec4899", "#06b6d4", "#10b981", "#f97316", "#8b5cf6", "#64748b", "#475569"].map(color => (
              <button
                key={color}
                onClick={() => setNewCatColor(color)}
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: "50%",
                  background: color,
                  border: newCatColor === color ? "3px solid #fff" : "none",
                  boxShadow: newCatColor === color ? `0 0 0 2px ${color}` : "none",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  transform: newCatColor === color ? "scale(1.15)" : "scale(1)"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                onMouseLeave={e => e.currentTarget.style.transform = newCatColor === color ? "scale(1.15)" : "scale(1)"}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "1rem",
              background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
              borderRadius: 12,
              border: `1px solid ${cBorder}`
            }}
          >
            <div style={{ position: "relative", width: 48, height: 48 }}>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  padding: 0,
                  border: "none",
                  borderRadius: "50%",
                  cursor: "pointer",
                  background: "none",
                  overflow: "hidden"
                }}
              />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${isDark ? "#333" : "#e2e8f0"}`, pointerEvents: "none" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: cFaint, textTransform: "uppercase", marginBottom: 2 }}>Podgląd</div>
              <div style={{ padding: "6px 14px", background: newCatColor, color: "#fff", borderRadius: 100, fontSize: 12, fontWeight: 800, textAlign: "center", textTransform: "uppercase", boxShadow: `0 4px 12px ${newCatColor}44` }}>
                {newCatInput || "NAZWA"}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "1.25rem 1.5rem", borderTop: `1px solid ${cBorder}`, background: isDark ? "rgba(0,0,0,0.1)" : "#fcfcfc", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "0.625rem 1.5rem", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${cBorder}`, background: "transparent", color: cMuted }}>Anuluj</button>
          <button onClick={() => onSave(newCatInput, newCatColor)} style={{ padding: "0.625rem 1.5rem", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: cPrimary, color: "#fff", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>Zapisz</button>
        </div>
      </div>
    </div>
  );
};

interface Email {
  id: number;
  sender?: string;
  subject?: string;
  body?: string;
  ai_category?: string;
  loading_city?: string;
  unloading_city?: string;
  loading_zip?: string;
  unloading_zip?: string;
  weight_kg?: number | null;
  price?: number | null;
  currency?: string;
  received_at?: string;
}

interface PopupOpts {
  type: "delete" | "success" | "error" | "info";
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm?: () => void;
  hideCancel?: boolean;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Wszystkie" },
  { value: "unread", label: "Nieodczytane" },
  { value: "read", label: "Odczytane" },
  { value: "starred", label: "⭐ Oznaczone gwiazdką" },
];

function MailPageInner() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);

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

  const responsiveStyles = `
    .mail-list-container { display: block; }
    .mail-card-list { display: none; }
    @media (max-width: 1024px) {
      .mail-list-container { display: none; }
      .mail-card-list { display: flex; }
    }
  `;

  const cBorder = isDark ? "#252525" : "#e2e8f0";
  const cBg = isDark ? "#0a0a0a" : "#f8fafc";
  const cSurface = isDark ? "#111111" : "#ffffff";
  const cHover = isDark ? "#191919" : "#f1f5f9";
  const cText = isDark ? "#e8e8e8" : "#0f172a";
  const cMuted = isDark ? "#888888" : "#64748b";
  const cFaint = isDark ? "#555555" : "#94a3b8";
  const cPrimary = "#3b82f6";
  const cGreen = "#22c55e";
  const cStar = "#f59e0b";

  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [filtered, setFiltered] = useState<Email[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "table">(
    "loading",
  );
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState(
    () => searchParams.get("filter") ?? "",
  );
  const [statusFilter, setStatusFilter] = useState("all");

  const [starredIds, setStarredIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return new Set(
      JSON.parse(localStorage.getItem("starredEmails") || "[]") as number[],
    );
  });
  const [readIds, setReadIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return new Set(
      JSON.parse(localStorage.getItem("readEmails") || "[]") as number[],
    );
  });

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const lastCheckedIdx = useRef(-1);

  const [customCats, setCustomCats] = useState<{ name: string; color: string }[]>([]);

  // Dynamiczna lista kategorii: hardkodowane + te z bazy (custom) + te, które faktycznie występują w mailach
  const allCats = useMemo(() => {
    const fromEmails = Array.from(new Set(allEmails.map(e => e.ai_category).filter(Boolean))) as string[];
    const combined = [...DEFAULT_CATS, ...customCats.map(c => c.name), ...fromEmails];
    return Array.from(new Set(combined));
  }, [allEmails, customCats]);

  useEffect(() => {
    fetch("/api/backend/api/custom-categories", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomCats(data);
      })
      .catch(() => { });
  }, []);

  const [modal, setModal] = useState<Email | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [popup, setPopup] = useState<PopupOpts | null>(null);
  const pendingConfirmRef = useRef<(() => void) | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setCatFilter(searchParams.get("filter") ?? "");
  }, [searchParams]);

  const loadEmails = useCallback(async () => {
    setLoadState("loading");
    try {
      const r = await fetch("/api/backend/api/emails?limit=500", {
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      const emails: Email[] = Array.isArray(data)
        ? data
        : data.emails || data.items || [];
      setAllEmails(emails);
    } catch {
      setLoadState("empty");
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    const s = search.toLowerCase();
    const list = allEmails.filter((e) => {
      const matchSearch =
        !s ||
        (e.sender || "").toLowerCase().includes(s) ||
        (e.subject || "").toLowerCase().includes(s);
      const matchCat = !catFilter || e.ai_category === catFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "unread" && !readIds.has(e.id)) ||
        (statusFilter === "read" && readIds.has(e.id)) ||
        (statusFilter === "starred" && starredIds.has(e.id));
      return matchSearch && matchCat && matchStatus;
    });
    setFiltered(list);
    setLoadState(
      list.length ? "table" : allEmails.length ? "empty" : "loading",
    );
  }, [allEmails, search, catFilter, statusFilter, readIds, starredIds]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".popraw-dropdown-wrap")) setOpenDropdown(null);
      if (!target.closest(".status-dropdown-wrap")) setIsStatusDropdownOpen(false);
      if (!target.closest(".cat-dropdown-wrap")) setIsCatDropdownOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setCatModal(false);
        setOpenDropdown(null);
        exitDeleteMode();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function showPopup(opts: PopupOpts) {
    pendingConfirmRef.current = opts.onConfirm || null;
    setPopup(opts);
  }
  function handlePopupConfirm() {
    const fn = pendingConfirmRef.current;
    setPopup(null);
    if (fn) fn();
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelectedIds(new Set());
    lastCheckedIdx.current = -1;
  }

  function toggleStar(id: number, ev: React.MouseEvent) {
    ev.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("starredEmails", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function markRead(id: number) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("readEmails", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function toggleSelect(
    id: number,
    idx: number,
    checked: boolean,
    shift: boolean,
  ) {
    if (shift && lastCheckedIdx.current !== -1) {
      const from = Math.min(lastCheckedIdx.current, idx);
      const to = Math.max(lastCheckedIdx.current, idx);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((e, i) => {
          if (i >= from && i <= to)
            checked ? next.add(e.id) : next.delete(e.id);
        });
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        checked ? next.add(id) : next.delete(id);
        return next;
      });
    }
    lastCheckedIdx.current = idx;
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filtered.map((e) => e.id)) : new Set());
    lastCheckedIdx.current = -1;
  }

  const allChecked =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));
  const anyChecked = filtered.some((e) => selectedIds.has(e.id));

  function deleteEmail(id: number) {
    setModal(null);
    showPopup({
      type: "delete",
      title: "Usuń wiadomość",
      message:
        "Czy na pewno chcesz usunąć tę wiadomość? Tej operacji nie można cofnąć.",
      confirmText: "Usuń",
      cancelText: "Anuluj",
      onConfirm: async () => {
        try {
          await fetch(`/api/backend/api/emails/${id}`, {
            method: "DELETE",
            credentials: "include",
          });
          setAllEmails((prev) => prev.filter((e) => e.id !== id));
          setSelectedIds((prev) => {
            const n = new Set(prev);
            n.delete(id);
            return n;
          });
          showPopup({
            type: "success",
            title: "Usunięto",
            message: "Wiadomość została pomyślnie usunięta.",
            confirmText: "OK",
            hideCancel: true,
          });
        } catch {
          showPopup({
            type: "error",
            title: "Błąd",
            message: "Nie udało się usunąć wiadomości.",
            confirmText: "OK",
            hideCancel: true,
          });
        }
      },
    });
  }

  function deleteSelected() {
    if (!selectedIds.size) {
      showPopup({
        type: "info",
        title: "Brak zaznaczonych",
        message: "Zaznacz wiadomości które chcesz usunąć.",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    showPopup({
      type: "delete",
      title: `Usuń ${selectedIds.size} wiadomości`,
      message: `Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych wiadomości? Tej operacji nie można cofnąć.`,
      confirmText: "Usuń wszystkie",
      cancelText: "Anuluj",
      onConfirm: async () => {
        try {
          await Promise.all(
            Array.from(selectedIds).map((id) =>
              fetch(`/api/backend/api/emails/${id}`, {
                method: "DELETE",
                credentials: "include",
              }),
            ),
          );
          setAllEmails((prev) => prev.filter((e) => !selectedIds.has(e.id)));
          exitDeleteMode();
          showPopup({
            type: "success",
            title: "Usunięto",
            message: "Zaznaczone wiadomości zostały usunięte.",
            confirmText: "OK",
            hideCancel: true,
          });
        } catch {
          showPopup({
            type: "error",
            title: "Błąd",
            message: "Nie udało się usunąć wiadomości.",
            confirmText: "OK",
            hideCancel: true,
          });
        }
      },
    });
  }

  async function reclassify(id: number, newCat: string) {
    setOpenDropdown(null);
    try {
      await fetch(`/api/backend/api/emails/${id}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category: newCat }),
      });
      setAllEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ai_category: newCat } : e)),
      );
    } catch {
      showPopup({
        type: "error",
        title: "Błąd",
        message: "Nie udało się zmienić kategorii.",
        confirmText: "OK",
        hideCancel: true,
      });
    }
  }

  function scanInne() {
    showPopup({
      type: "info",
      title: "Skanowanie INNE",
      message:
        "Czy chcesz ponownie przeskanować maile z kategorią 'INNE'? AI użyje też Twoich własnych kategorii.",
      confirmText: "Skanuj",
      onConfirm: async () => {
        setScanning(true);
        try {
          const r = await fetch("/api/backend/api/emails/rescan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({}),
          });
          const data = await r.json();
          if (data.usage) trackUsage(data.usage);
          await loadEmails();
          showPopup({
            type: "success",
            title: "Skanowanie zakończone",
            message: `Przeskanowano: ${data.scanned ?? "?"}, zaktualizowano: ${data.updated ?? "?"}`,
            confirmText: "OK",
            hideCancel: true,
          });
        } catch {
          showPopup({
            type: "error",
            title: "Błąd skanowania",
            message: "Nie udało się przeskanować wiadomości.",
            confirmText: "OK",
            hideCancel: true,
          });
        } finally {
          setScanning(false);
        }
      },
    });
  }

  function trackUsage(usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
  }) {
    const stored = JSON.parse(
      localStorage.getItem("aiUsageTotal") ||
      '{"prompt_tokens":0,"completion_tokens":0}',
    );
    stored.prompt_tokens += usage.prompt_tokens || 0;
    stored.completion_tokens += usage.completion_tokens || 0;
    localStorage.setItem("aiUsageTotal", JSON.stringify(stored));
  }

  async function handleSaveCat(name: string, color: string) {
    if (!name.trim()) return;
    try {
      const res = await fetch("/api/backend/api/custom-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) throw new Error();
      const newCat = await res.json();
      setCustomCats((prev) => [...prev, newCat]);
      setCatModal(false);
      showPopup({
        type: "success",
        title: "Dodano",
        message: `Kategoria ${name} została utworzona.`,
        confirmText: "OK",
        hideCancel: true,
      });
    } catch {
      showPopup({
        type: "error",
        title: "Błąd",
        message: "Nie udało się zapisać kategorii.",
        confirmText: "OK",
        hideCancel: true,
      });
    }
  }

  function StarButton({ id }: { id: number }) {
    const starred = starredIds.has(id);
    return (
      <button
        onClick={(ev) => toggleStar(id, ev)}
        title={starred ? "Usuń gwiazdkę" : "Oznacz gwiazdką"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: starred ? cStar : cFaint,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = cStar)}
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = starred ? cStar : cFaint)
        }
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={starred ? cStar : "none"}
          stroke={starred ? cStar : "currentColor"}
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        .mail-tbl tbody tr:hover { background: ${cHover}; }
        .mail-tbl tbody tr.is-selected { background: rgba(59,130,246,0.08) !important; outline: 1px solid rgba(59,130,246,0.25); outline-offset: -1px; }
        .mail-tbl tbody tr.is-selected td:first-child { border-left: 3px solid ${cPrimary}; }
        .btn-del-row:hover { background: rgba(239,68,68,0.08); color: #ef4444; border-color: #fca5a5; }
        .filter-input:focus { border-color: ${cPrimary}; outline: none; }
        .filter-select:focus { border-color: ${cPrimary}; outline: none; }
        .mail-card { background: ${cSurface}; border: 1px solid ${cBorder}; border-radius: 10px; padding: 0.875rem 1rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.625rem; }
        .mail-card:active { background: ${cHover}; }
        .mail-card.is-selected { border-color: ${cPrimary} !important; background: rgba(59,130,246,0.06) !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        
        .email-body-content { overflow: auto; }
        .email-body-content img, .email-body-content table { max-width: 100% !important; height: auto !important; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 768px) {
          .mail-tbl-wrap-desktop { display: none !important; }
          .mail-card-list { display: flex !important; }
          .mail-filters-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) { .mail-filters-grid { grid-template-columns: 1fr !important; } }
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
          {/* ── Top bar ── */}
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: cText,
                  margin: 0,
                }}
              >
                Poczta AI
              </h2>
              <p style={{ fontSize: 12, color: cMuted, margin: 0 }}>
                Klasyfikacja i zarządzanie mailami spedycyjnymi
              </p>
            </div>
            <button
              onClick={scanInne}
              disabled={scanning}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                borderRadius: 8,
                background: scanning
                  ? "linear-gradient(135deg, #6d28d9, #5b21b6)"
                  : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "#fff",
                border: "none",
                cursor: scanning ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                opacity: scanning ? 0.75 : 1,
                boxShadow: scanning
                  ? "none"
                  : "0 2px 8px rgba(124,58,237,0.35)",
                transition: "all 0.2s",
              }}
            >
              {scanning ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid #fff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "_spin 0.7s linear infinite",
                    }}
                  />
                  Skanowanie…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  Skanuj INNE
                </>
              )}
            </button>
          </header>

          {/* ── Delete mode banner ── */}
          {deleteMode && (
            <div
              style={{
                flexShrink: 0,
                background: "#7f1d1d",
                borderBottom: "1px solid #ef4444",
                padding: "0.6rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                color: "#fff",
                boxShadow: "inset 0 -10px 20px rgba(0,0,0,0.1)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #ef4444" }} />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.02em" }}>TRYB USUWANIA AKTYWNY</span>
                {selectedIds.size > 0 && (
                  <span style={{ marginLeft: 8, background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>
                    Zaznaczono: {selectedIds.size}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDeleteMode(false)}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                >
                  Wyjdź (Anuluj)
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    style={{
                      padding: "0.4rem 1.25rem",
                      borderRadius: 8,
                      border: "none",
                      background: "#fff",
                      color: "#dc2626",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
                    }}
                  >
                    Usuń wybrane
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: cBg }}>
            {/* ── Filter bar ── */}
            <div
              className="mail-filters-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "1rem",
                alignItems: "end",
                padding: "0.75rem 1.5rem",
                background: cSurface,
                borderBottom: `1px solid ${cBorder}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: cFaint, marginBottom: 6 }}>Szukaj w temacie / nadawcy</div>
                <input className="filter-input" type="text" placeholder="np. Trans.eu, DE-PL..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", height: 40, padding: "0 0.875rem", border: `1px solid ${cBorder}`, borderRadius: 10, background: cBg, fontSize: 12, color: cText, boxSizing: "border-box" }} />
              </div>
              <div className="status-dropdown-wrap" style={{ minWidth: 160, position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: cFaint, marginBottom: 6 }}>Status</div>
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  style={{ width: "100%", height: 40, padding: "0 1rem", border: `1px solid ${cBorder}`, borderRadius: 10, background: cBg, fontSize: 12, color: cText, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s", boxSizing: "border-box" }}
                >
                  <span>{STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={cFaint} strokeWidth="2.5" style={{ transform: isStatusDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {isStatusDropdownOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: isDark ? "#111" : "#fff", border: `1px solid ${cBorder}`, borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", zIndex: 110, padding: 6, animation: "fadeInUp 0.15s ease-out" }}>
                    {STATUS_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => { setStatusFilter(o.value); setIsStatusDropdownOpen(false); }}
                        style={{ width: "100%", padding: "0.6rem 0.875rem", border: "none", background: statusFilter === o.value ? (isDark ? "rgba(59,130,246,0.1)" : "#f1f5f9") : "transparent", color: statusFilter === o.value ? cPrimary : cText, borderRadius: 8, textAlign: "left", fontSize: 12, fontWeight: statusFilter === o.value ? 700 : 500, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = statusFilter === o.value ? (isDark ? "rgba(59,130,246,0.1)" : "#f1f5f9") : "transparent"}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="cat-dropdown-wrap" style={{ minWidth: 200, position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: cFaint, marginBottom: 6 }}>Kategoria AI</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <button
                      onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                      style={{ width: "100%", height: 40, padding: "0 1rem", border: `1px solid ${cBorder}`, borderRadius: 10, background: cBg, fontSize: 12, color: cText, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s", boxSizing: "border-box" }}
                    >
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {catFilter ? catFilter : "Wszystkie kategorie"}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={cFaint} strokeWidth="2.5" style={{ transform: isCatDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {isCatDropdownOpen && (
                      <div className="no-scrollbar" style={{ position: "absolute", top: "100%", left: 0, minWidth: "100%", width: "max-content", maxWidth: 300, marginTop: 8, background: isDark ? "#111" : "#fff", border: `1px solid ${cBorder}`, borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.3)", zIndex: 110, padding: 6, maxHeight: 400, overflowY: "auto", animation: "fadeInUp 0.15s ease-out" }}>
                        <button
                          onClick={() => { setCatFilter(""); setIsCatDropdownOpen(false); }}
                          style={{ width: "100%", padding: "0.6rem 0.875rem", border: "none", background: !catFilter ? (isDark ? "rgba(59,130,246,0.1)" : "#f1f5f9") : "transparent", color: !catFilter ? cPrimary : cText, borderRadius: 8, textAlign: "left", fontSize: 12, fontWeight: !catFilter ? 700 : 500, cursor: "pointer", marginBottom: 2 }}
                        >
                          Wszystkie kategorie
                        </button>
                        {allCats.map(c => (
                          <button
                            key={c}
                            onClick={() => { setCatFilter(c); setIsCatDropdownOpen(false); }}
                            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "none", background: catFilter === c ? (isDark ? "rgba(59,130,246,0.1)" : "#f1f5f9") : "transparent", borderRadius: 8, textAlign: "left", cursor: "pointer", marginBottom: 2 }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = catFilter === c ? (isDark ? "rgba(59,130,246,0.1)" : "#f1f5f9") : "transparent"}
                          >
                            <CatPill cat={c} small customCats={customCats} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setCatModal(true)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: `1px solid ${cPrimary}`,
                      background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)",
                      color: cPrimary,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 400,
                      transition: "all 0.2s",
                      boxSizing: "border-box",
                      padding: 0,
                      lineHeight: 0
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)"}
                  >
                    <span style={{ marginBottom: 4 }}>+</span>
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "end" }}>
                <button
                  onClick={() => deleteMode ? deleteSelected() : setDeleteMode(true)}
                  style={{
                    height: 40,
                    padding: "0 1.25rem",
                    borderRadius: 10,
                    border: `1px solid #ef4444`,
                    background: deleteMode ? "#dc2626" : "transparent",
                    color: deleteMode ? "#fff" : "#ef4444",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    boxSizing: "border-box"
                  }}
                  onMouseEnter={e => { if (!deleteMode) e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
                  onMouseLeave={e => { if (!deleteMode) e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Usuń wiele
                </button>
              </div>
            </div>

            {/* ── Content area ── */}
            <div style={{ flex: 1, overflowY: "auto", background: cSurface }}>
              <style>{responsiveStyles}</style>
              {loadState === "loading" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 2rem", color: cFaint }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${cPrimary}`, borderTopColor: "transparent", borderRadius: "50%", animation: "_spin 0.7s linear infinite", marginBottom: 12 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ładowanie...</span>
                </div>
              )}
              {loadState === "empty" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 2rem", color: cFaint }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Brak maili</span>
                </div>
              )}
              {loadState === "table" && (
                <div className="mail-list-container" style={{ width: "100%", minWidth: 900 }}>
                  {/* ── Sticky Header ── */}
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      display: "grid",
                      gridTemplateColumns: deleteMode ? "45px 30px 130px 1fr 120px 60px 75px 75px 120px 75px 30px" : "30px 130px 1fr 120px 60px 75px 75px 120px 75px 30px",
                      gap: "18px",
                      padding: "0.75rem 1.5rem",
                      background: isDark ? "#0a0a0a" : "#fff",
                      borderBottom: `1px solid ${cBorder}`,
                      alignItems: "center",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
                    }}
                  >
                    {deleteMode && (
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = !allChecked && anyChecked; }} onChange={e => toggleAll(e.target.checked)} />
                      </div>
                    )}
                    <div /> {/* Star column */}
                    {["Nadawca", "Temat", "Trasa", "Waga", "Cena", "Kategoria", "", "", ""].map((h, i) => (
                      <div key={i} style={{ fontSize: 9, fontWeight: 800, color: cFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</div>
                    ))}
                  </div>

                  {/* ── Rows ── */}
                  {filtered.map((e, idx) => (
                    <EmailRow
                      key={e.id} e={e} idx={idx}
                      sel={selectedIds.has(e.id)} isUnread={!readIds.has(e.id)}
                      isStarred={starredIds.has(e.id)}
                      isDark={isDark} cBorder={cBorder} cGreen={cGreen} cFaint={cFaint} cPrimary={cPrimary} cText={cText}
                      deleteMode={deleteMode} toggleSelect={toggleSelect} toggleStar={toggleStar}
                      markRead={markRead} setModal={setModal}
                      customCats={customCats} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown}
                      reclassify={reclassify} allCats={allCats} setCatModal={setCatModal}
                      onDeleteOne={() => setAllEmails(allEmails.filter(m => m.id !== e.id))}
                    />
                  ))}
                </div>
              )}
              {loadState === "table" && (
                <div className="mail-card-list" style={{ flexDirection: "column", gap: "0.75rem", padding: "1rem" }}>
                  {filtered.map((e, idx) => (
                    <MobileEmailCard
                      key={e.id} e={e} idx={idx}
                      sel={selectedIds.has(e.id)} isUnread={!readIds.has(e.id)}
                      isStarred={starredIds.has(e.id)}
                      isDark={isDark} cBorder={cBorder} cFaint={cFaint} cPrimary={cPrimary} cText={cText} cGreen={cGreen} cMuted={cMuted}
                      deleteMode={deleteMode} toggleSelect={toggleSelect} toggleStar={toggleStar}
                      markRead={markRead} setModal={setModal}
                      customCats={customCats} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown}
                      reclassify={reclassify} allCats={allCats} setCatModal={setCatModal}
                      onDeleteOne={() => setAllEmails(allEmails.filter(m => m.id !== e.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: szczegóły maila ── */}
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            style={{
              background: cSurface,
              border: `1px solid ${cBorder}`,
              borderRadius: 12,
              width: "100%",
              maxWidth: 700,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "1.25rem 1.5rem",
                borderBottom: `1px solid ${cBorder}`,
                gap: "1rem",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: cText }}>
                    {modal.subject || "(brak tematu)"}
                  </div>
                  <StarButton id={modal.id} />
                </div>
                <div style={{ fontSize: 11, color: cFaint, marginTop: 3 }}>
                  Od: {modal.sender || "—"} ·{" "}
                  {modal.received_at
                    ? new Date(modal.received_at).toLocaleString("pl-PL")
                    : ""}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${isDark ? "#333" : "#e2e8f0"}`,
                  background: isDark ? "#1a1a1a" : "#f1f5f9",
                  color: cMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div
              style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: cFaint,
                  marginBottom: "0.625rem",
                }}
              >
                Dane wyodrębnione przez AI
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.25rem" }}>
                {[
                  { label: "Kategoria", val: modal.ai_category || "INNE", hi: true },
                  { label: "Trasa", val: `${modal.loading_city || "?"} → ${modal.unloading_city || "?"}` },
                  { label: "Waga", val: fmtWeight(modal.weight_kg) },
                  { label: "Stawka", val: fmtPrice(modal.price, modal.currency) },
                  { label: "Załadunek ZIP", val: modal.loading_zip || "—" },
                  { label: "Rozładunek ZIP", val: modal.unloading_zip || "—" }
                ].map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 600,
                      color: tag.hi ? "#3b82f6" : "#888",
                      background: tag.hi ? "rgba(59,130,246,0.1)" : (isDark ? "#191919" : "#f1f5f9"),
                      border: tag.hi ? "1px solid rgba(59,130,246,0.3)" : `1px solid ${isDark ? "#252525" : "#e2e8f0"}`,
                      display: "inline-flex",
                      alignItems: "center"
                    }}
                  >
                    {tag.label}: <strong style={{ marginLeft: 4, color: tag.hi ? "#3b82f6" : (isDark ? "#e8e8e8" : "#0f172a") }}>{tag.val}</strong>
                  </span>
                ))}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: cFaint,
                  marginBottom: "0.625rem",
                }}
              >
                Treść wiadomości
              </div>
              <div
                className="email-body-content"
                style={{
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: isDark ? "#888" : "#444",
                }}
                dangerouslySetInnerHTML={{
                  __html: modal.body
                    ? DOMPurify.sanitize(modal.body)
                    : "(brak treści)",
                }}
              />
            </div>
            <div style={{ padding: "1.25rem 1.5rem", borderTop: `1px solid ${cBorder}`, background: cSurface, display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => deleteEmail(modal.id)}
                style={{
                  padding: "0.625rem 1.5rem",
                  borderRadius: 8,
                  border: `1px solid ${isDark ? "#333" : "#e2e8f0"}`,
                  background: "transparent",
                  color: "#ef4444",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Usuń
              </button>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding: "0.625rem 1.5rem",
                  borderRadius: 8,
                  border: `1px solid ${isDark ? "#333" : "#e2e8f0"}`,
                  background: "transparent",
                  color: cText,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Zamknij
              </button>
              <button
                style={{
                  padding: "0.625rem 1.5rem",
                  borderRadius: 8,
                  border: "none",
                  background: cPrimary,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(59,130,246,0.3)"
                }}
              >
                Odpowiedz
              </button>
            </div>
          </div>
        </div>
      )}

      <AddCategoryModal
        isOpen={catModal}
        onClose={() => setCatModal(false)}
        onSave={handleSaveCat}
        cSurface={cSurface}
        cBorder={cBorder}
        cText={cText}
        cHover={cHover}
        cMuted={cMuted}
        cFaint={cFaint}
        cBg={cBg}
        cPrimary={cPrimary}
        isDark={isDark}
      />

      {/* ── Popup ── */}
      {popup &&
        (() => {
          const PS = {
            delete: {
              iconBg: isDark ? "rgba(239,68,68,0.2)" : "#fee2e2",
              iconColor: isDark ? "#f87171" : "#dc2626",
              btnBg: "#dc2626",
              btnHover: "#b91c1c",
            },
            error: {
              iconBg: isDark ? "rgba(239,68,68,0.2)" : "#fee2e2",
              iconColor: isDark ? "#f87171" : "#dc2626",
              btnBg: "#dc2626",
              btnHover: "#b91c1c",
            },
            info: {
              iconBg: isDark ? "rgba(59,130,246,0.2)" : "#dbeafe",
              iconColor: isDark ? "#60a5fa" : "#2563eb",
              btnBg: "#2563eb",
              btnHover: "#1d4ed8",
            },
            success: {
              iconBg: isDark ? "rgba(34,197,94,0.2)" : "#dcfce7",
              iconColor: isDark ? "#4ade80" : "#16a34a",
              btnBg: "#16a34a",
              btnHover: "#15803d",
            },
          };
          const ICONS: Record<string, React.ReactNode> = {
            delete: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            ),
            error: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ),
            info: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ),
            success: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ),
          };
          const s = PS[popup.type] ?? PS.info;
          const icon = ICONS[popup.type] ?? ICONS.info;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 400,
                background: isDark ? "rgba(0,0,0,0.8)" : "rgba(15,23,42,0.6)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  background: cSurface,
                  border: `1px solid ${cBorder}`,
                  borderRadius: 16,
                  width: "100%",
                  maxWidth: 380,
                  boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
                  overflow: "hidden",
                  textAlign: "center",
                }}
              >
                <div style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: s.iconBg,
                      color: s.iconColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 1rem",
                    }}
                  >
                    {icon}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: cText,
                      marginBottom: "0.5rem",
                    }}
                  >
                    {popup.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: cMuted,
                      lineHeight: 1.65,
                      marginBottom: "1.5rem",
                    }}
                  >
                    {popup.message}
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {!popup.hideCancel && (
                      <button
                        onClick={() => setPopup(null)}
                        style={{
                          flex: 1,
                          padding: "0.625rem",
                          borderRadius: 8,
                          border: "none",
                          background: isDark ? "#2a2a2a" : "#f1f5f9",
                          color: cText,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isDark
                          ? "#333"
                          : "#e2e8f0")
                        }
                        onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isDark
                          ? "#2a2a2a"
                          : "#f1f5f9")
                        }
                      >
                        {popup.cancelText || "Anuluj"}
                      </button>
                    )}
                    <button
                      onClick={handlePopupConfirm}
                      style={{
                        flex: 1,
                        padding: "0.625rem",
                        borderRadius: 8,
                        border: "none",
                        background: s.btnBg,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = s.btnHover)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = s.btnBg)
                      }
                    >
                      {popup.confirmText || "OK"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}

export default function MailPage() {
  return (
    <Suspense fallback={null}>
      <MailPageInner />
    </Suspense>
  );
}
