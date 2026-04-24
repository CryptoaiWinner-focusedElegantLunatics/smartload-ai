"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "../components/Sidebar";
import DOMPurify from "dompurify";


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

const DEFAULT_CATS = [
  "OFERTA",
  "ZAMOWIENIE",
  "FAKTURA",
  "DOKUMENT_CMR",
  "INNE",
];

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  OFERTA: { bg: "#1d4ed8", text: "#fff" },
  ZAMOWIENIE: { bg: "#059669", text: "#fff" },
  FAKTURA: { bg: "#7c3aed", text: "#fff" },
  INNE: { bg: "#475569", text: "#fff" },
  DOKUMENT_CMR: { bg: "#d97706", text: "#fff" },
};

const HASH_PALETTE = [
  { bg: "#db2777", text: "#fff" },
  { bg: "#0891b2", text: "#fff" },
  { bg: "#4f46e5", text: "#fff" },
  { bg: "#b45309", text: "#fff" },
  { bg: "#15803d", text: "#fff" },
  { bg: "#0f766e", text: "#fff" },
  { bg: "#9333ea", text: "#fff" },
  { bg: "#c2410c", text: "#fff" },
];

function getCatColor(cat: string) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  let hash = 0;
  for (let i = 0; i < cat.length; i++)
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  const color = HASH_PALETTE[Math.abs(hash) % HASH_PALETTE.length];
  CAT_COLORS[cat] = color;
  return color;
}

function fmtWeight(w: number | null | undefined) {
  return w != null ? (w / 1000).toFixed(1) + " t" : "—";
}
function fmtPrice(p: number | null | undefined, currency = "EUR") {
  return p != null ? Number(p).toLocaleString("pl-PL") + " " + currency : "—";
}

interface PopupOpts {
  type: "delete" | "success" | "error" | "info";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  onConfirm?: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Wszystkie" },
  { value: "unread", label: "Nieodczytane" },
  { value: "read", label: "Odczytane" },
  { value: "starred", label: "⭐ Oznaczone gwiazdką" },
];

function MailPageInner() {
  const searchParams = useSearchParams();

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

  const [customCats, setCustomCats] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("customCategories") || "[]");
  });
  const allCats = [...DEFAULT_CATS, ...customCats];

  const [modal, setModal] = useState<Email | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [popup, setPopup] = useState<PopupOpts | null>(null);
  const pendingConfirmRef = useRef<(() => void) | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
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
      if ((e.target as HTMLElement).closest(".popraw-dropdown-wrap")) return;
      setOpenDropdown(null);
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
      localStorage.setItem("starredEmails", JSON.stringify([...next]));
      return next;
    });
  }

  function markRead(id: number) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("readEmails", JSON.stringify([...next]));
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
            [...selectedIds].map((id) =>
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
        method: "PATCH",
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
            body: JSON.stringify({ custom_categories: customCats }),
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

  function saveCat() {
    const cat = newCatInput
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
    if (!cat) {
      showPopup({
        type: "error",
        title: "Błąd",
        message: "Nazwa kategorii nie może być pusta.",
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    if (allCats.includes(cat)) {
      showPopup({
        type: "info",
        title: "Już istnieje",
        message: `Kategoria "${cat}" już jest na liście.`,
        confirmText: "OK",
        hideCancel: true,
      });
      return;
    }
    const next = [...customCats, cat];
    setCustomCats(next);
    localStorage.setItem("customCategories", JSON.stringify(next));
    setCatModal(false);
    setNewCatInput("");
    showPopup({
      type: "success",
      title: "Dodano kategorię",
      message: `Kategoria "${cat}" została dodana.`,
      confirmText: "OK",
      hideCancel: true,
    });
  }

  function CatPill({ cat, small = false }: { cat: string; small?: boolean }) {
    const { bg, text } = getCatColor(cat);
    return (
      <span
        style={{
          display: "inline-block",
          padding: small ? "2px 8px" : "3px 12px",
          borderRadius: 100,
          fontSize: small ? 10 : 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          background: bg,
          color: text,
          border: `1px solid ${bg}`,
        }}
      >
        {cat}
      </span>
    );
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

  function PoprawDropdown({
    emailId,
    keyId,
  }: {
    emailId: number;
    keyId: number;
  }) {
    const isOpen = openDropdown === keyId;
    return (
      <div
        className="popraw-dropdown-wrap"
        style={{ position: "relative", display: "inline-flex" }}
      >
        <button
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setOpenDropdown((prev) => (prev === keyId ? null : keyId));
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "0.3rem 0.625rem",
            borderRadius: 6,
            border: `1px solid ${cBorder}`,
            background: cSurface,
            fontSize: 11,
            fontWeight: 600,
            color: cMuted,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Popraw AI <span style={{ fontSize: 9 }}>▾</span>
        </button>
        {isOpen && (
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              zIndex: 100,
              background: cSurface,
              border: `1px solid ${cBorder}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              minWidth: 165,
              overflow: "hidden",
            }}
          >
            {allCats.map((c) => (
              <button
                key={c}
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  reclassify(emailId, c);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  gap: "0.5rem",
                }}
                onMouseEnter={(el) =>
                  (el.currentTarget.style.background = cHover)
                }
                onMouseLeave={(el) =>
                  (el.currentTarget.style.background = "transparent")
                }
              >
                <CatPill cat={c} small />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── KONIEC CZĘŚCI 1 — ciąg dalszy w części 2 ──  return (
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
                padding: "6px 12px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                opacity: scanning ? 0.7 : 1,
                boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
              }}
            >
              {scanning ? "⏳ Skanowanie…" : "⚡ Skanuj INNE"}
            </button>
          </header>

          {/* ── Delete mode banner ── */}
          {deleteMode && (
            <div
              style={{
                flexShrink: 0,
                background: isDark ? "#1a0f0f" : "#fff5f5",
                borderBottom: "1px solid #fca5a5",
                padding: "0.6rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M9 6V4h6v2" />
              </svg>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#ef4444",
                  flex: 1,
                }}
              >
                Tryb usuwania — kliknij maile do zaznaczenia
                {selectedIds.size > 0 && ` (${selectedIds.size} zaznaczonych)`}
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={deleteSelected}
                  style={{
                    padding: "0.35rem 0.875rem",
                    borderRadius: 6,
                    border: "none",
                    background: "#dc2626",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Usuń {selectedIds.size}
                </button>
              )}
              <button
                onClick={exitDeleteMode}
                style={{
                  padding: "0.35rem 0.875rem",
                  borderRadius: 6,
                  border: "1px solid #fca5a5",
                  background: "transparent",
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Anuluj
              </button>
            </div>
          )}

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: cBg,
            }}
          >
            {/* ── Filter bar ── */}
            <div
              className="mail-filters-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "0.75rem",
                alignItems: "end",
                padding: "1rem 1.5rem",
                background: cSurface,
                borderBottom: `1px solid ${cBorder}`,
                flexShrink: 0,
              }}
            >
              {/* Search */}
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: cFaint,
                    marginBottom: 4,
                  }}
                >
                  Szukaj w temacie / nadawcy
                </div>
                <input
                  className="filter-input"
                  type="text"
                  placeholder="np. Trans.eu, DE-PL..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.875rem",
                    border: `1px solid ${cBorder}`,
                    borderRadius: 8,
                    background: cBg,
                    fontSize: 12,
                    color: cText,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Status filter */}
              <div style={{ minWidth: 170 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: cFaint,
                    marginBottom: 4,
                  }}
                >
                  Status
                </div>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 2rem 0.55rem 0.875rem",
                    border: `1px solid ${cBorder}`,
                    borderRadius: 8,
                    background: cBg,
                    fontSize: 12,
                    color: cText,
                    cursor: "pointer",
                    appearance: "none",
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.6rem center",
                  }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div style={{ minWidth: 200 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: cFaint,
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Kategoria AI</span>
                  <button
                    onClick={() => {
                      setNewCatInput("");
                      setCatModal(true);
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1px solid ${cBorder}`,
                      background: "transparent",
                      color: cFaint,
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    +
                  </button>
                </div>
                <select
                  className="filter-select"
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 2rem 0.55rem 0.875rem",
                    border: `1px solid ${cBorder}`,
                    borderRadius: 8,
                    background: cBg,
                    fontSize: 12,
                    color: cText,
                    cursor: "pointer",
                    appearance: "none",
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.6rem center",
                  }}
                >
                  <option value="">Wszystkie kategorie</option>
                  {allCats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Usuń wiele */}
              <button
                onClick={() =>
                  deleteMode ? deleteSelected() : setDeleteMode(true)
                }
                style={{
                  padding: "0.55rem 1rem",
                  borderRadius: 8,
                  border: deleteMode ? "none" : "1px solid #fca5a5",
                  background: deleteMode ? "#dc2626" : "transparent",
                  color: deleteMode ? "#fff" : "#ef4444",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Usuń wiele
              </button>
            </div>

            {/* ── Content area ── */}
            <div style={{ flex: 1, overflowY: "auto", background: cSurface }}>
              {loadState === "loading" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "5rem 2rem",
                    color: cFaint,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      border: `2px solid ${cPrimary}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "_spin 0.7s linear infinite",
                    }}
                  />
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      margin: 0,
                    }}
                  >
                    Ładowanie maili…
                  </p>
                </div>
              )}

              {loadState === "empty" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "5rem 2rem",
                    color: cFaint,
                  }}
                >
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ opacity: 0.25 }}
                  >
                    <path d="M22 12h-6l-2 3H10l-2-3H2" />
                    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                  </svg>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      margin: 0,
                    }}
                  >
                    Brak maili
                  </p>
                </div>
              )}

              {/* ── Desktop table ── */}
              {loadState === "table" && (
                <div className="mail-tbl-wrap-desktop">
                  <table
                    className="mail-tbl"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: 44,
                            padding: "0.625rem 0.5rem 0.625rem 1rem",
                            textAlign: "center",
                            background: cSurface,
                            borderBottom: `1px solid ${cBorder}`,
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          {deleteMode ? (
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => {
                                if (el)
                                  el.indeterminate = !allChecked && anyChecked;
                              }}
                              onChange={(e) => toggleAll(e.target.checked)}
                              style={{ cursor: "pointer" }}
                            />
                          ) : (
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={cFaint}
                              strokeWidth="2"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          )}
                        </th>
                        {[
                          "Nadawca",
                          "Temat",
                          "Trasa",
                          "Waga",
                          "Stawka",
                          "Kategoria AI",
                          "Akcje",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "0.625rem 1rem",
                              textAlign: h === "Akcje" ? "right" : "left",
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              color: cFaint,
                              background: cSurface,
                              borderBottom: `1px solid ${cBorder}`,
                              position: "sticky",
                              top: 0,
                              zIndex: 2,
                              whiteSpace: "nowrap",
                              paddingRight:
                                h === "Akcje" ? "1.25rem" : undefined,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e, idx) => {
                        const cat = e.ai_category || "INNE";
                        const sel = selectedIds.has(e.id);
                        const isUnread = !readIds.has(e.id);
                        return (
                          <tr
                            key={e.id}
                            className={sel ? "is-selected" : ""}
                            onClick={() => {
                              if (deleteMode) {
                                toggleSelect(e.id, idx, !sel, false);
                              } else {
                                markRead(e.id);
                                setModal(e);
                              }
                            }}
                            style={{
                              borderBottom: `1px solid ${cBorder}`,
                              cursor: "pointer",
                              transition: "background 0.1s",
                              background:
                                isUnread && !sel
                                  ? isDark
                                    ? "rgba(59,130,246,0.04)"
                                    : "rgba(59,130,246,0.03)"
                                  : undefined,
                            }}
                          >
                            {/* Star / checkbox */}
                            <td
                              style={{
                                paddingLeft: "1rem",
                                paddingRight: "0.5rem",
                                verticalAlign: "middle",
                                textAlign: "center",
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {deleteMode ? (
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={(ev) =>
                                    toggleSelect(
                                      e.id,
                                      idx,
                                      ev.target.checked,
                                      false,
                                    )
                                  }
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    toggleSelect(
                                      e.id,
                                      idx,
                                      (ev.target as HTMLInputElement).checked,
                                      (ev as React.MouseEvent).shiftKey,
                                    );
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                              ) : (
                                <StarButton id={e.id} />
                              )}
                            </td>
                            {/* Nadawca */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                minWidth: 180,
                                maxWidth: 220,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {isUnread && (
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      background: cPrimary,
                                      flexShrink: 0,
                                      display: "inline-block",
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isUnread ? 700 : 500,
                                    color: cText,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "block",
                                  }}
                                  title={e.sender || ""}
                                >
                                  {e.sender || "—"}
                                </span>
                              </div>
                            </td>
                            {/* Temat */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                minWidth: 180,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: isUnread ? 700 : 400,
                                  color: cText,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: 300,
                                  display: "block",
                                }}
                                title={e.subject || ""}
                              >
                                {e.subject || "(brak tematu)"}
                              </span>
                            </td>
                            {/* Trasa */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                                minWidth: 160,
                              }}
                            >
                              <span style={{ fontSize: 13, color: cText }}>
                                {e.loading_city || "?"}
                                <span
                                  style={{ color: cFaint, margin: "0 4px" }}
                                >
                                  →
                                </span>
                                {e.unloading_city || "?"}
                              </span>
                            </td>
                            {/* Waga */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                                color: cMuted,
                                fontSize: 13,
                              }}
                            >
                              {fmtWeight(e.weight_kg)}
                            </td>
                            {/* Stawka */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: cGreen,
                                  fontSize: 13,
                                }}
                              >
                                {fmtPrice(e.price, e.currency)}
                              </span>
                            </td>
                            {/* Kategoria */}
                            <td
                              style={{
                                padding: "0.8rem 1rem",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <CatPill cat={cat} />
                            </td>
                            {/* Akcje */}
                            <td
                              style={{
                                padding: "0.8rem 1.25rem 0.8rem 1rem",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                                textAlign: "right",
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {!deleteMode && (
                                  <PoprawDropdown emailId={e.id} keyId={e.id} />
                                )}
                                <button
                                  className="btn-del-row"
                                  onClick={() => deleteEmail(e.id)}
                                  title="Usuń"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    border: `1px solid ${cBorder}`,
                                    background: "transparent",
                                    color: cFaint,
                                    cursor: "pointer",
                                    transition:
                                      "background 0.1s, color 0.1s, border-color 0.1s",
                                  }}
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M9 6V4h6v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Mobile cards ── */}
              {loadState === "table" && (
                <div
                  className="mail-card-list"
                  style={{
                    display: "none",
                    flexDirection: "column",
                    gap: "0.75rem",
                    padding: "1rem",
                  }}
                >
                  {filtered.map((e, idx) => {
                    const cat = e.ai_category || "INNE";
                    const sel = selectedIds.has(e.id);
                    const mobileKey = -e.id;
                    const isUnread = !readIds.has(e.id);
                    return (
                      <div
                        key={e.id}
                        className={`mail-card${sel ? " is-selected" : ""}`}
                        onClick={() => {
                          if (deleteMode) {
                            toggleSelect(e.id, idx, !sel, false);
                          } else {
                            markRead(e.id);
                            setModal(e);
                          }
                        }}
                        style={{
                          borderLeft: isUnread
                            ? `3px solid ${cPrimary}`
                            : undefined,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              onClick={(ev) => ev.stopPropagation()}
                              style={{ flexShrink: 0, marginTop: 1 }}
                            >
                              {deleteMode ? (
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={(ev) =>
                                    toggleSelect(
                                      e.id,
                                      idx,
                                      ev.target.checked,
                                      false,
                                    )
                                  }
                                  style={{ cursor: "pointer" }}
                                />
                              ) : (
                                <StarButton id={e.id} />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: cPrimary,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {e.sender || "—"}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: isUnread ? 700 : 400,
                                  color: cText,
                                  lineHeight: 1.4,
                                  marginTop: 2,
                                }}
                              >
                                {e.subject || "(brak tematu)"}
                              </div>
                            </div>
                          </div>
                          <CatPill cat={cat} />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            background: cBg,
                            borderRadius: 7,
                            padding: "0.5rem 0.75rem",
                          }}
                        >
                          <div style={{ flex: 1, textAlign: "center" }}>
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: cFaint,
                                marginBottom: 2,
                              }}
                            >
                              Start
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: cText,
                              }}
                            >
                              {e.loading_city || "?"}
                            </div>
                          </div>
                          <div style={{ color: cFaint, flexShrink: 0 }}>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M17 8l4 4-4 4M3 12h18" />
                            </svg>
                          </div>
                          <div style={{ flex: 1, textAlign: "center" }}>
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: cFaint,
                                marginBottom: 2,
                              }}
                            >
                              Koniec
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: cText,
                              }}
                            >
                              {e.unloading_city || "?"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", gap: "1.25rem" }}>
                            <div>
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  color: cFaint,
                                }}
                              >
                                Waga
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: cText,
                                }}
                              >
                                {fmtWeight(e.weight_kg)}
                              </div>
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  color: cFaint,
                                }}
                              >
                                Stawka
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: cGreen,
                                }}
                              >
                                {fmtPrice(e.price, e.currency)}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.375rem",
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {!deleteMode && (
                              <PoprawDropdown
                                emailId={e.id}
                                keyId={mobileKey}
                              />
                            )}
                            <button
                              className="btn-del-row"
                              onClick={() => deleteEmail(e.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${cBorder}`,
                                background: "transparent",
                                color: cFaint,
                                cursor: "pointer",
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `1px solid ${cBorder}`,
                  background: cHover,
                  color: cMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "1.25rem",
                }}
              >
                {[
                  { label: "Kategoria", val: modal.ai_category, hi: true },
                  {
                    label: "Trasa",
                    val: `${modal.loading_city || "?"} → ${modal.unloading_city || "?"}`,
                  },
                  {
                    label: "Waga",
                    val:
                      modal.weight_kg != null
                        ? fmtWeight(modal.weight_kg)
                        : null,
                  },
                  {
                    label: "Stawka",
                    val:
                      modal.price != null
                        ? fmtPrice(modal.price, modal.currency)
                        : null,
                  },
                  { label: "Załadunek ZIP", val: modal.loading_zip || null },
                  { label: "Rozładunek ZIP", val: modal.unloading_zip || null },
                ]
                  .filter((c) => c.val)
                  .map((c, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 100,
                        fontSize: 11,
                        fontWeight: 600,
                        color: c.hi ? cPrimary : cMuted,
                        background: c.hi ? "rgba(59,130,246,0.1)" : cHover,
                        border: `1px solid ${c.hi ? "rgba(59,130,246,0.3)" : cBorder}`,
                      }}
                    >
                      {c.label}: <strong>{c.val}</strong>
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
                  color: cMuted,
                }}
                dangerouslySetInnerHTML={{
                  __html: modal.body ? DOMPurify.sanitize(modal.body) : "(brak treści)",
                }}
              />

            </div>
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: `1px solid ${cBorder}`,
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => deleteEmail(modal.id)}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${cBorder}`,
                  background: cSurface,
                  color: "#ef4444",
                }}
              >
                Usuń
              </button>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${cBorder}`,
                  background: cSurface,
                  color: cMuted,
                }}
              >
                Zamknij
              </button>
              <button
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${cPrimary}`,
                  background: cPrimary,
                  color: "#fff",
                }}
              >
                Odpowiedz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Dodaj kategorię ── */}
      {catModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCatModal(false);
          }}
        >
          <div
            style={{
              background: cSurface,
              border: `1px solid ${cBorder}`,
              borderRadius: 12,
              width: "100%",
              maxWidth: 380,
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1.25rem 1.5rem",
                borderBottom: `1px solid ${cBorder}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: cText }}>
                Dodaj kategorię AI
              </span>
              <button
                onClick={() => setCatModal(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `1px solid ${cBorder}`,
                  background: cHover,
                  color: cMuted,
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              <label
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: cFaint,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Nazwa kategorii (np. REKLAMACJA)
              </label>
              <input
                autoFocus
                type="text"
                placeholder="WPISZ_NAZWE"
                value={newCatInput}
                onChange={(e) =>
                  setNewCatInput(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCat();
                }}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.875rem",
                  border: `1px solid ${cBorder}`,
                  borderRadius: 8,
                  background: cBg,
                  color: cText,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: `1px solid ${cBorder}`,
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setCatModal(false)}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${cBorder}`,
                  background: cSurface,
                  color: cMuted,
                }}
              >
                Anuluj
              </button>
              <button
                onClick={saveCat}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${cPrimary}`,
                  background: cPrimary,
                  color: "#fff",
                }}
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

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
