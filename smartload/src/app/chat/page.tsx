"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../components/AuthContext";
import { usePusherChat, ChatMsg } from "../hooks/usePusherChat";

// ── Types ──
interface Contact { id: number; username: string; role: string; }

interface AiHistoryMsg {
  id: number;
  user_id: number;
  role: string;
  content: string;
  timestamp: string;
}

interface AiChatUser {
  id: number;
  username: string;
  role: string;
  message_count: number;
}

interface OfferCard {
  id: string; route_from: string; route_to: string;
  price: string; weight: string;
}
interface AssignedRoute {
  id: number;
  loading_city: string;
  unloading_city: string;
  status: string;
  cmr_link: string | null;
  weight_kg?: number;
  price?: number;
  source_id?: string;
  assigned_at?: string;
}

interface AiMsg {
  id: number;
  role: "ai" | "user";
  text: string;
  time: string;
  offerCards?: OfferCard[];
  selectedOfferIdx?: number;       // która karta jest wybrana
  offerState?: "pending" | "accepted" | "rejected";
  assignedRoutes?: AssignedRoute[];
  isHtml?: boolean;
}

function now() {
  return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

// ── Parse AI response ──
function parseAiResponse(raw: string): { text: string; offerCards?: OfferCard[]; assignedRoutes?: AssignedRoute[]; isHtml?: boolean } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const p = JSON.parse(trimmed);
      if (p.type === "offer_card") {
        // Tablica "offers" (nowa) lub "offer" (stary fallback)
        const cards: OfferCard[] = p.offers ?? (p.offer ? [p.offer] : []);
        return { text: p.message || "Znalazłem oferty!", offerCards: cards.length > 0 ? cards : undefined };
      }
      if (p.type === "assigned_routes") {
        return { text: p.message || "Znalezione trasy:", assignedRoutes: p.routes };
      }
    } catch { /* not JSON */ }
  }
  const isHtml = /<[a-z]/.test(trimmed);
  return { text: trimmed, isHtml };
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  PRZYPISANE:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  "W DRODZE":  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  ROZŁADOWANE: { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
};

function Chip({ icon, label, isDark }: { icon: string; label: string; isDark: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0"}`, color: isDark ? "#94a3b8" : "#475569" }}>
      {icon} {label}
    </span>
  );
}

function AssignedRouteCard({ route, isDark }: { route: AssignedRoute; isDark: boolean }) {
  const style = STATUS_STYLE[route.status] ?? STATUS_STYLE["PRZYPISANE"];
  const date = route.assigned_at ? new Date(route.assigned_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const cardBg = isDark ? "#191919" : "#ffffff";
  const cardBorder = isDark ? "#252525" : "#e2e8f0";
  const textColor = isDark ? "#f1f5f9" : "#1e293b";
  const mutedColor = isDark ? "#64748b" : "#94a3b8";

  return (
    <div style={{ borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}`, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, #3b82f6, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13" />
            <polyline points="16 8 20 8 23 11 23 16 16 16" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {route.loading_city} <span style={{ margin: "0 6px", color: "#3b82f6" }}>→</span> {route.unloading_city}
          </div>
          {date && <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>Przypisano: {date}</div>}
        </div>

        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 100, color: style.color, background: style.bg, border: `1px solid ${style.border}`, flexShrink: 0 }}>
          {route.status}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {route.weight_kg != null && <Chip icon="⚖️" label={`${route.weight_kg.toLocaleString("pl-PL")} kg`} isDark={isDark} />}
        {route.price != null && route.price > 0 && <Chip icon="💶" label={`${route.price.toLocaleString("pl-PL", { minimumFractionDigits: 0 })} EUR`} isDark={isDark} />}
        {route.source_id && <Chip icon="🔗" label={`ID: ${route.source_id.slice(0, 10)}…`} isDark={isDark} />}
      </div>

      {route.cmr_link && (
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${cardBorder}`, paddingTop: 12, marginTop: 4 }}>
          <a href={route.cmr_link} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Pokaż CMR
          </a>
        </div>
      )}
    </div>
  );
}

function AssignedRoutesList({ routes, cCard, cBorder, cText, cFaint, cPrimary, isDark }: any) {
  const [showCompleted, setShowCompleted] = useState(false);
  const activeRoutes = routes.filter((r: AssignedRoute) => r.status !== "ROZŁADOWANE");
  const completedRoutes = routes.filter((r: AssignedRoute) => r.status === "ROZŁADOWANE");

  return (
    <div className="flex flex-col gap-3">
      {activeRoutes.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold" style={{ color: cText }}>Aktywne trasy ({activeRoutes.length})</div>
          {activeRoutes.map((r: AssignedRoute) => (
            <AssignedRouteCard key={r.id} route={r} isDark={isDark} />
          ))}
        </div>
      ) : (
        <div className="text-sm italic" style={{ color: cFaint }}>Brak aktywnych tras.</div>
      )}

      {completedRoutes.length > 0 && (
        <div className="mt-2 border-t pt-3" style={{ borderColor: cBorder }}>
          <button 
            onClick={() => setShowCompleted(!showCompleted)} 
            className="text-xs font-semibold hover:underline flex items-center gap-1" 
            style={{ color: cFaint, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            {showCompleted ? "Ukryj" : "Pokaż"} zakończone trasy ({completedRoutes.length})
          </button>
          
          {showCompleted && (
            <div className="flex flex-col gap-3 mt-3 opacity-80">
              {completedRoutes.map((r: AssignedRoute) => (
                <AssignedRouteCard key={r.id} route={r} isDark={isDark} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { role } = useAuth();
  const [myId, setMyId] = useState<number | null>(null);

  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const u = () => setIsDark(document.documentElement.classList.contains("dark"));
    u();
    const obs = new MutationObserver(u);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const cBg = isDark ? "#0a0a0a" : "#f8fafc";
  const cSurface = isDark ? "#111111" : "#ffffff";
  const cBorder = isDark ? "#252525" : "#e2e8f0";
  const cCard = isDark ? "#161616" : "#ffffff";
  const cText = isDark ? "#e8e8e8" : "#0f172a";
  const cFaint = isDark ? "#555" : "#94a3b8";
  const cPrimary = "#3b82f6";
  const cAccent = isDark ? "#f59e0b" : "#3b82f6";

  // ── AI History ──
  const [showHistory, setShowHistory] = useState(false);
  const [aiHistory, setAiHistory] = useState<AiHistoryMsg[]>([]);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiChatUsers, setAiChatUsers] = useState<AiChatUser[]>([]);
  const [selectedHistoryUserId, setSelectedHistoryUserId] = useState<number | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // ── AI History Search/Filter ──
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Filtrowane wiadomości (po słowach + dacie)
  const filteredAiHistory = aiHistory.filter(msg => {
    // Filtr tekstowy
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const parsed = parseHistoryContent(msg.content, msg.role).toLowerCase();
      if (!parsed.includes(q)) return false;
    }
    // Filtr daty OD
    if (historyDateFrom) {
      const msgDate = new Date(msg.timestamp).toISOString().slice(0, 10);
      if (msgDate < historyDateFrom) return false;
    }
    // Filtr daty DO
    if (historyDateTo) {
      const msgDate = new Date(msg.timestamp).toISOString().slice(0, 10);
      if (msgDate > historyDateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = historySearchQuery.trim() !== "" || historyDateFrom !== "" || historyDateTo !== "";

  function clearHistoryFilters() {
    setHistorySearchQuery("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
  }

  // Pobierz listę userów z AI rozmowami (tylko admin)
  const fetchAiUsers = useCallback(async () => {
    if (role !== "ADMIN") return;
    try {
      const res = await fetch("/api/backend/api/chat/ai-users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAiChatUsers(data);
      }
    } catch { /* ignore */ }
  }, [role]);

  // Pobierz historię AI czatu
  const fetchAiHistory = useCallback(async (userId?: number) => {
    setAiHistoryLoading(true);
    try {
      const url = userId
        ? `/api/backend/api/chat/ai-history/${userId}`
        : "/api/backend/api/chat/ai-history";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAiHistory(data);
      } else {
        setAiHistory([]);
      }
    } catch {
      setAiHistory([]);
    } finally {
      setAiHistoryLoading(false);
    }
  }, []);

  // Po otwarciu panelu historii
  useEffect(() => {
    if (showHistory) {
      if (role === "ADMIN") {
        fetchAiUsers();
      }
      fetchAiHistory(selectedHistoryUserId ?? undefined);
    }
  }, [showHistory, selectedHistoryUserId, role, fetchAiHistory, fetchAiUsers]);

  // Scroll do dołu historii
  useEffect(() => {
    if (showHistory) {
      setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [aiHistory, showHistory]);

  // Parsuj treść AI (wyciągnij czytelny tekst z JSONa)
  function parseHistoryContent(raw: string, msgRole: string): string {
    if (msgRole === "user") return raw;
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const p = JSON.parse(trimmed);
        if (p.type === "offer_card" && p.message) return p.message;
        if (p.text) return p.text;
      } catch { /* not json */ }
    }
    return trimmed;
  }

  // ── Contacts ──
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | "ai">("ai");
  useEffect(() => {
    fetch("/api/backend/api/chat/contacts", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setContacts).catch(() => { });
  }, []);

  // ── Human WS (cookie-based, no token needed) ──
  const [humanMessages, setHumanMessages] = useState<ChatMsg[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Ref śledzenia aktywnego contacta — pozwala uniknąć stale closure w onIncoming
  const currentContactIdRef = useRef<number | null>(null);
  useEffect(() => {
    currentContactIdRef.current = selectedContact !== "ai"
      ? (selectedContact as Contact).id
      : null;
  }, [selectedContact]);

  // onIncoming: dodaje wiadomość TYLKO jeśli pasuje do aktywnej rozmowy
  // Zależy od ref (nie od stanu) więc nie ma stale closure
  const onIncoming = useCallback((msg: ChatMsg) => {
    const cid = currentContactIdRef.current;
    if (!cid) return;
    if (msg.sender_id !== cid && msg.receiver_id !== cid) return;
    setHumanMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
  }, []);

  const { status: wsStatus, sendMessage: pusherSend, myId: pusherMyId } = usePusherChat({
    onConnected: setMyId,
    onMessage: onIncoming,
  });

  // Ustaw myId z Pusher jeśli jeszcze nie ustawiony
  useEffect(() => { if (pusherMyId && !myId) setMyId(pusherMyId); }, [pusherMyId, myId]);

  useEffect(() => {
    if (selectedContact === "ai") { setHumanMessages([]); return; }
    const c = selectedContact as Contact;
    setHistoryLoading(true);
    setHumanMessages([]);
    fetch(`/api/backend/api/chat/history/${c.id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setHumanMessages).catch(() => { })
      .finally(() => setHistoryLoading(false));
  }, [selectedContact]);

  // ── AI WS ──
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([{
    id: 0, role: "ai", time: now(),
    text: "Cześć! 👋 Jestem Twoim asystentem SmartLoad AI.\nPowiedz mi skąd szukasz ładunku — sprawdzę co mamy! 🚛",
  }]);

  useEffect(() => {
    if (role === "KIEROWCA") {
      setAiMessages(prev => {
        const newMsg = [...prev];
        if (newMsg[0].id === 0) {
          newMsg[0].text = "Cześć! 👋 Jestem Twoim asystentem SmartLoad AI.\nZapytaj mnie o swoje przypisane trasy, chętnie je wyświetlę! 🚛";
        }
        return newMsg;
      });
    }
  }, [role]);

  const [aiTyping, setAiTyping] = useState(false);
  const aiWsRef = useRef<WebSocket | null>(null);
  const aiMsgId = useRef(1);

  const connectAiWs = useCallback(() => {
    const ws = aiWsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const initWs = async () => {
      try {
        const res = await fetch("/api/backend/api/ws-ticket", { credentials: "include" });
        const data = await res.json();
        const token = data.ticket || "";

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/backend/ws/chat?token=${token}`;

        const newWs = new WebSocket(wsUrl);
        aiWsRef.current = newWs;

        newWs.onopen = () => console.log("[AI WS] connected ✓");
        newWs.onmessage = (e) => {
          setAiTyping(false);
          const { text, offerCards, assignedRoutes, isHtml } = parseAiResponse(e.data);
          setAiMessages(prev => [...prev, {
            id: aiMsgId.current++, role: "ai", text, time: now(),
            offerCards,
            offerState: offerCards ? "pending" : undefined,
            assignedRoutes,
            isHtml,
          }]);
        };
        newWs.onclose = (e) => {
          console.log(`[AI WS] closed (code=${e.code}), reconnect in 5s...`);
          if (e.code === 1008) return;
          setTimeout(connectAiWs, 5000);
        };
        newWs.onerror = () => {
          console.warn("[AI WS] connection error — backend niedostępny?");
        };
      } catch (err) {
        console.error("[AI WS] Failed to get ticket", err);
        setTimeout(connectAiWs, 5000);
      }
    };
    
    initWs();
  }, []);

  useEffect(() => { connectAiWs(); return () => aiWsRef.current?.close(); }, [connectAiWs]);

  // ── Dialog przypisania trasy ──
  interface AssignDialog {
    msgId: number;
    card: OfferCard;
    step: "ask" | "input" | "loading" | "done" | "error";
    driverQuery: string;
    errorMsg?: string;
  }
  const [assignDialog, setAssignDialog] = useState<AssignDialog | null>(null);

  // Lista kierowców do autocomplete
  interface DriverOption { id: number; username: string; email: string | null; vehicle_plate: string | null; }
  const [driverList, setDriverList] = useState<DriverOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Załaduj kierowców gdy dialog przechodzi do kroku "input"
  useEffect(() => {
    if (assignDialog?.step === "input" && driverList.length === 0) {
      fetch("/api/backend/api/drivers", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(setDriverList)
        .catch(() => { });
    }
  }, [assignDialog?.step]);

  const filteredDrivers = driverList.filter(d => {
    const q = assignDialog?.driverQuery?.toLowerCase() ?? "";
    if (q.length < 2) return false;
    return d.username.toLowerCase().includes(q) || (d.email ?? "").toLowerCase().includes(q);
  });

  function acceptOffer(msgId: number) {
    const msg = aiMessages.find(m => m.id === msgId);
    const idx = msg?.selectedOfferIdx ?? 0;
    const card = msg?.offerCards?.[idx];
    setAiMessages(prev => prev.map(m => m.id === msgId ? { ...m, offerState: "accepted" } : m));

    if (role === "ADMIN" || role === "SPEDYTOR") {
      // Spedytor/Admin nie podaje rejestracji — pokazujemy pożegnanie i dialog przypisania
      setAiMessages(prev => [...prev, {
        id: aiMsgId.current++,
        role: "ai",
        text: `Świetnie! ✅ Oferta <b>${card?.route_from ?? "?"} → ${card?.route_to ?? "?"}</b> została zarezerwowana.<br>Dziękujemy za współpracę i zapraszamy do kolejnych zleceń! 🤝`,
        time: now(),
        isHtml: true,
      }]);
      if (card) {
        setAssignDialog({ msgId, card, step: "ask", driverQuery: "" });
      }
    } else {
      // Kierowca — stary flow: AI pyta o tablicę rejestracyjną do CMR
      sendAi(`Przyjmuję ofertę ${card?.id ?? ""}, biorę to`);
    }
  }

  async function doAssign() {
    if (!assignDialog) return;
    const { card, driverQuery } = assignDialog;
    setAssignDialog(d => d ? { ...d, step: "loading" } : null);

    // Parsuj wagę i cenę z string (np. "24000 kg" → 24000)
    const weight = parseFloat(card.weight) || 0;
    const price = parseFloat(card.price) || 0;

    try {
      const res = await fetch("/api/backend/api/routes/assign-by-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_email: driverQuery.trim(),
          loading_city: card.route_from,
          unloading_city: card.route_to,
          weight_kg: weight,
          price,
          source_id: card.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Błąd ${res.status}`);
      }
      setAssignDialog(d => d ? { ...d, step: "done" } : null);
      setTimeout(() => setAssignDialog(null), 3000);
    } catch (e: unknown) {
      setAssignDialog(d => d ? { ...d, step: "error", errorMsg: e instanceof Error ? e.message : "Błąd" } : null);
    }
  }

  function rejectOffer(msgId: number) {
    setAiMessages(prev => prev.map(m => m.id === msgId ? { ...m, offerState: "rejected" } : m));
    sendAi("Nie, szukaj następnej");
  }

  function selectOffer(msgId: number, idx: number) {
    setAiMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, selectedOfferIdx: idx } : m
    ));
  }

  // ── Input ──
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages, humanMessages, aiTyping]);

  const sendAi = useCallback((text: string) => {
    // 1. Dodajemy Twoją wiadomość na ekran
    setAiMessages(prev => [...prev, {
      id: aiMsgId.current++,
      role: "user",
      text: text,
      time: now()
    }]);

    // 2. Odpalamy animację ładowania
    setAiTyping(true);

    // 3. WYSYŁAMY PRZEZ ODPOWIEDNI WEBSOCKET (aiWsRef)
    const ws = aiWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("🚀 [AI WS] WYSYŁAM FIZYCZNIE DO SERWERA:", text);
      ws.send(text);

      // Jeśli Twój Python oczekuje JSONa (np. await websocket.receive_json()), 
      // to zakomentuj linijkę wyżej i odkomentuj tę poniżej:
      // ws.send(JSON.stringify({ text }));
    } else {
      console.warn("Brak połączenia z czatem AI!");
      setAiTyping(false); // wyłączamy mielenie, skoro nie poszło
    }
  }, []);

  function sendMsg() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (selectedContact === "ai") {
      sendAi(text);
    } else {
      const c = selectedContact as Contact;
      // NIE dodajemy optimistic update - czekamy na echo "sent" z serwera
      // (echo zawiera prawdziwe DB id, które przetrwa F5)
      pusherSend(c.id, text);
    }
  }

  const isHuman = selectedContact !== "ai";
  const activeContact = isHuman ? (selectedContact as Contact) : null;

  // ── OfferCardUI ──
  function OfferCardUI({ card, selected, onSelect }: {
    card: OfferCard;
    selected: boolean;
    onSelect?: () => void;
  }) {
    return (
      <div
        onClick={onSelect}
        style={{
          background: selected ? (isDark ? "rgba(59,130,246,0.1)" : "#eff6ff") : (isDark ? "#0d0d0d" : "#f8fafc"),
          border: selected ? "1.5px solid #3b82f6" : `1px solid ${cBorder}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 6,
          cursor: onSelect ? "pointer" : "default",
          transition: "all 0.15s",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: cText }}>Ładunek {card.id}</div>
            <div style={{ fontSize: 11, color: cFaint, marginTop: 1 }}>{card.weight}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: cPrimary }}>{card.price}</div>
            {onSelect && (
              <div
                style={{
                  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                  padding: "3px 10px", borderRadius: 100, border: selected ? "none" : `1px solid ${cBorder}`,
                  background: selected ? "#3b82f6" : "transparent",
                  color: selected ? "#fff" : cFaint,
                  transition: "all 0.15s",
                }}
              >
                {selected ? "✓ Wybrana" : "Wybierz"}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: cFaint, marginBottom: 2 }}>Załadunek</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: cText }}>📍 {card.route_from}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: cFaint, marginBottom: 2 }}>Rozładunek</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: cText }}>🏁 {card.route_to}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideInL{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInR{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
        @keyframes offerPulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.4)}50%{box-shadow:0 0 0 6px rgba(59,130,246,0)}}
        .bbl{animation:slideInL .2s ease}.bbr{animation:slideInR .2s ease}
        .td1{animation:blink 1.2s infinite}.td2{animation:blink 1.2s .2s infinite}.td3{animation:blink 1.2s .4s infinite}
        .contact-btn:hover{background:${isDark ? "#191919" : "#f1f5f9"}!important}
        #chatScroll::-webkit-scrollbar{width:4px}
        #chatScroll::-webkit-scrollbar-thumb{background:${cFaint};border-radius:2px}
        textarea{resize:none;outline:none;background:transparent;border:none;font-family:inherit}
        .offer-pulse{animation:offerPulse 2s infinite}
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: cBg, fontFamily: '"Inter",system-ui,sans-serif' }}>
        <Sidebar />

        {/* Contacts */}
        <div style={{ width: 256, flexShrink: 0, background: cSurface, borderRight: `1px solid ${cBorder}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${cBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: cFaint, marginBottom: 6 }}>Komunikator</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: wsStatus === "online" ? "#22c55e" : cFaint }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: wsStatus === "online" ? "#22c55e" : cFaint }} />
              {wsStatus === "online" ? "P2P Online" : wsStatus === "connecting" ? "Łączenie…" : "Offline"}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            <button className="contact-btn" onClick={() => setSelectedContact("ai")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", cursor: "pointer", textAlign: "left", background: selectedContact === "ai" ? (isDark ? "#1a1a2e" : "#eff6ff") : "transparent", borderLeft: selectedContact === "ai" ? "3px solid #3b82f6" : "3px solid transparent", transition: "all 0.15s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800 }}>AI</div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: cText }}>Doradca AI</div><div style={{ fontSize: 11, color: cFaint }}>Asystent spedycyjny</div></div>
            </button>
            {contacts.length > 0 && <div style={{ padding: "10px 14px 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: cFaint }}>Kontakty ({contacts.length})</div>}
            {contacts.map(c => {
              const active = isHuman && (selectedContact as Contact).id === c.id;
              return (
                <button key={c.id} className="contact-btn" onClick={() => setSelectedContact(c)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", cursor: "pointer", textAlign: "left", background: active ? (isDark ? "#1a1a2e" : "#eff6ff") : "transparent", borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent", transition: "all 0.15s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800 }}>{c.username.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.username}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b" }}>{c.role}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat window */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ flexShrink: 0, background: cSurface, borderBottom: `1px solid ${cBorder}`, padding: "11px 22px", display: "flex", alignItems: "center", gap: 12 }}>
            {selectedContact === "ai" ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>AI</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: cText }}>SmartLoad Spedytor AI</div><div style={{ fontSize: 11, color: cFaint }}>Asystent — szuka ładunków</div></div>
                {/* Przycisk Historia */}
                <button
                  id="btn-ai-history"
                  onClick={() => setShowHistory(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 10,
                    border: `1px solid ${cBorder}`,
                    background: isDark ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.08)",
                    color: cAccent,
                    fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isDark ? "rgba(245,158,11,0.2)" : "rgba(59,130,246,0.15)";
                    e.currentTarget.style.borderColor = cAccent;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isDark ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.08)";
                    e.currentTarget.style.borderColor = cBorder;
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historia
                </button>
              </>
            ) : activeContact ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>{activeContact.username.slice(0, 2).toUpperCase()}</div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: cText }}>{activeContact.username}</div><div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase" }}>{activeContact.role}</div></div>
              </>
            ) : null}
          </div>

          {/* Messages */}
          <div id="chatScroll" style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", background: cBg }}>
            {selectedContact === "ai" ? (
              <>
                {aiMessages.map(msg => (
                  <div key={msg.id} className={msg.role === "user" ? "bbr" : "bbl"} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                    {msg.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>AI</div>}
                    <div style={{ maxWidth: "80%" }}>
                      <div style={{ background: msg.role === "user" ? cPrimary : cCard, border: msg.role === "ai" ? `1px solid ${cBorder}` : "none", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px" }}>
                        {msg.offerCards && msg.offerCards.length > 0 ? (
                          <>
                            <p style={{ margin: "0 0 10px", fontSize: 13, color: cText, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: msg.text }} />
                            {msg.offerCards.map((card, idx) => (
                              <OfferCardUI
                                key={idx}
                                card={card}
                                selected={msg.selectedOfferIdx === idx}
                                onSelect={msg.offerState === "pending" ? () => selectOffer(msg.id, idx) : undefined}
                              />
                            ))}
                            {msg.offerState === "pending" && (
                              msg.selectedOfferIdx === undefined ? (
                                <p style={{ fontSize: 11, color: cFaint, margin: "8px 0 0", textAlign: "center", fontStyle: "italic" }}>
                                  ☝️ Kliknij w ofertę, żeby ją wybrać
                                </p>
                              ) : (
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                  <button className="offer-pulse" onClick={() => acceptOffer(msg.id)} style={{ flex: 1, background: cPrimary, color: "#fff", border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ Przyjmij i bookuj</button>
                                  <button onClick={() => rejectOffer(msg.id)} style={{ flex: 1, background: "transparent", color: cFaint, border: `1px solid ${cBorder}`, borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ Odrzuć</button>
                                </div>
                              )
                            )}
                            {msg.offerState === "accepted" && <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#22c55e", padding: "9px 0", background: isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, marginTop: 8 }}>✅ Zaakceptowano!</div>}
                            {msg.offerState === "rejected" && <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: cFaint, padding: "9px 0", background: isDark ? "#111" : cBg, border: `1px solid ${cBorder}`, borderRadius: 10, marginTop: 8 }}>❌ Odrzucono</div>}
                          </>
                        ) : msg.assignedRoutes && msg.assignedRoutes.length > 0 ? (
                          <>
                            <p style={{ margin: "0 0 10px", fontSize: 13, color: cText, lineHeight: 1.6 }}>{msg.text}</p>
                            <AssignedRoutesList routes={msg.assignedRoutes} cCard={cCard} cBorder={cBorder} cText={cText} cFaint={cFaint} cPrimary={cPrimary} isDark={isDark} />
                          </>
                        ) : msg.isHtml ? (
                          <p style={{ margin: 0, fontSize: 13, color: msg.role === "user" ? "#fff" : cText, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: msg.text }} />
                        ) : (
                          <p style={{ margin: 0, fontSize: 13, color: msg.role === "user" ? "#fff" : cText, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: cFaint, marginTop: 2, textAlign: msg.role === "user" ? "right" : "left", padding: "0 4px" }}>
                        {msg.role === "user" ? `Ty · ${msg.time}` : `SmartLoad AI · ${msg.time}`}
                      </div>
                    </div>
                  </div>
                ))}
                {aiTyping && (
                  <div className="bbl" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800 }}>AI</div>
                    <div style={{ background: cCard, border: `1px solid ${cBorder}`, borderRadius: "18px 18px 18px 4px", padding: "12px 16px", display: "flex", gap: 4, alignItems: "center" }}>
                      {[1, 2, 3].map(i => <span key={i} className={`td${i}`} style={{ width: 6, height: 6, borderRadius: "50%", background: cFaint, display: "inline-block" }} />)}
                    </div>
                  </div>
                )}
              </>
            ) : historyLoading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: cFaint, fontSize: 13 }}>Ładowanie historii…</div>
            ) : humanMessages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: cFaint }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Napisz pierwszą wiadomość do {activeContact?.username}</div>
              </div>
            ) : (
              humanMessages.map(msg => {
                const isMe = msg.sender_id === myId;
                return (
                  <div key={msg.id} className={isMe ? "bbr" : "bbl"} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                    {!isMe && <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{activeContact?.username.slice(0, 2).toUpperCase()}</div>}
                    <div style={{ maxWidth: "72%" }}>
                      <div style={{ background: isMe ? cPrimary : cCard, border: !isMe ? `1px solid ${cBorder}` : "none", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px" }}>
                        <p style={{ margin: 0, fontSize: 13, color: isMe ? "#fff" : cText, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                        <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px', color: isMe ? '#fff' : cFaint }}>[Od: {msg.sender_id}]</div>
                      </div>
                      <div style={{ fontSize: 10, color: cFaint, marginTop: 2, textAlign: isMe ? "right" : "left", padding: "0 4px" }}>
                        {isMe ? "Ty" : activeContact?.username} · {new Date(msg.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ flexShrink: 0, background: cSurface, borderTop: `1px solid ${cBorder}`, padding: "12px 20px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 860, margin: "0 auto" }}>
              <div style={{ flex: 1, background: cBg, border: `1px solid ${cBorder}`, borderRadius: 18, padding: "10px 16px", display: "flex" }}>
                <textarea
                  ref={textareaRef} rows={1}
                  placeholder={selectedContact === "ai" ? "Napisz do AI… (Enter = wyślij)" : `Napisz do ${activeContact?.username ?? "kontaktu"}…`}
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  style={{ width: "100%", fontSize: 13, color: cText, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}
                />
              </div>
              <button
                onClick={sendMsg} disabled={!input.trim()}
                style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: input.trim() ? "linear-gradient(135deg,#3b82f6,#6366f1)" : (isDark ? "#1e1e1e" : "#e2e8f0"), color: input.trim() ? "#fff" : cFaint, cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0, boxShadow: input.trim() ? "0 4px 12px rgba(59,130,246,0.35)" : "none" }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Przypisz trasę do kierowcy ── */}
      {assignDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: cSurface, border: `1px solid ${cBorder}`, borderRadius: 18, padding: "28px 32px", width: 380, maxWidth: "90vw", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>

            {assignDialog.step === "ask" && (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: cText, marginBottom: 8 }}>🚛 Przypisz trasę?</div>
                <p style={{ fontSize: 13, color: cFaint, marginBottom: 20, lineHeight: 1.5 }}>
                  Zaakceptowałeś ofertę <b style={{ color: cText }}>{assignDialog.card.route_from} → {assignDialog.card.route_to}</b>.
                  <br />Czy chcesz przypisać ją konkretnemu kierowcy?
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setAssignDialog(d => d ? { ...d, step: "input" } : null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ✅ Tak, przypisz
                  </button>
                  <button onClick={() => setAssignDialog(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${cBorder}`, background: "transparent", color: cFaint, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Nie, później
                  </button>
                </div>
              </>
            )}

            {assignDialog.step === "input" && (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: cText, marginBottom: 4 }}>Wybierz kierowcę</div>
                <p style={{ fontSize: 12, color: cFaint, marginBottom: 12 }}>Wpisz imię, login lub e-mail — pojawią się podpowiedzi</p>

                {/* Input z dropdownem */}
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="🔍 Szukaj kierowcy…"
                    value={assignDialog.driverQuery}
                    onChange={e => {
                      setAssignDialog(d => d ? { ...d, driverQuery: e.target.value } : null);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && assignDialog.driverQuery.trim()) { setShowSuggestions(false); doAssign(); }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${showSuggestions && filteredDrivers.length > 0 ? "#3b82f6" : cBorder}`, background: cBg, color: cText, fontSize: 13, outline: "none", transition: "border-color 0.15s" }}
                  />

                  {/* Dropdown */}
                  {showSuggestions && filteredDrivers.length > 0 && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: cSurface, border: `1px solid ${cBorder}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 10 }}>
                      {filteredDrivers.map(d => (
                        <button
                          key={d.id}
                          onMouseDown={e => e.preventDefault()} // nie trać focusa z inputa
                          onClick={() => {
                            setAssignDialog(prev => prev ? { ...prev, driverQuery: d.email || d.username } : null);
                            setShowSuggestions(false);
                          }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = isDark ? "#1e1e1e" : "#f1f5f9")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Avatar */}
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {d.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: cText }}>{d.username}</div>
                            {d.email && <div style={{ fontSize: 11, color: cFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.email}</div>}
                            {d.vehicle_plate && <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700 }}>🚛 {d.vehicle_plate}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hint gdy za mało znaków */}
                  {showSuggestions && assignDialog.driverQuery.length > 0 && assignDialog.driverQuery.length < 2 && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: cSurface, border: `1px solid ${cBorder}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: cFaint }}>
                      Wpisz co najmniej 2 znaki…
                    </div>
                  )}
                </div>

                {assignDialog.errorMsg && (
                  <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12 }}>❌ {assignDialog.errorMsg}</p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowSuggestions(false); doAssign(); }} disabled={!assignDialog.driverQuery.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: assignDialog.driverQuery.trim() ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "#333", color: "#fff", fontWeight: 700, fontSize: 13, cursor: assignDialog.driverQuery.trim() ? "pointer" : "default" }}>
                    Przypisz →
                  </button>
                  <button onClick={() => setAssignDialog(null)} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${cBorder}`, background: "transparent", color: cFaint, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Anuluj
                  </button>
                </div>
              </>
            )}

            {assignDialog.step === "loading" && (
              <div style={{ textAlign: "center", padding: "16px 0", color: cFaint, fontSize: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                Przypisuję trasę…
              </div>
            )}

            {assignDialog.step === "done" && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#22c55e", marginBottom: 6 }}>Trasa przypisana!</div>
                <p style={{ fontSize: 12, color: cFaint }}>Kierowca otrzymał powiadomienie i widzi trasę w panelu Moje Trasy.</p>
              </div>
            )}

            {assignDialog.step === "error" && (
              <>
                <div style={{ textAlign: "center", fontSize: 28, marginBottom: 8 }}>❌</div>
                <p style={{ textAlign: "center", fontSize: 13, color: "#f87171", marginBottom: 16 }}>{assignDialog.errorMsg}</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setAssignDialog(d => d ? { ...d, step: "input", errorMsg: undefined } : null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Spróbuj ponownie
                  </button>
                  <button onClick={() => setAssignDialog(null)} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${cBorder}`, background: "transparent", color: cFaint, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Zamknij
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Panel historii czatu AI ── */}
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{
            background: cSurface, border: `1px solid ${cBorder}`, borderRadius: 20,
            width: "90vw", maxWidth: 720, height: "85vh", maxHeight: 700,
            display: "flex", flexDirection: "column",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}>
            {/* Header historii */}
            <div style={{
              flexShrink: 0, padding: "16px 24px",
              borderBottom: `1px solid ${cBorder}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: 13,
              }}>AI</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: cText }}>Historia czatu AI</div>
                <div style={{ fontSize: 11, color: cFaint }}>
                  {role === "ADMIN" && selectedHistoryUserId
                    ? `Rozmowy użytkownika: ${aiChatUsers.find(u => u.id === selectedHistoryUserId)?.username ?? ""}`
                    : "Twoje rozmowy z Doradcą AI"}
                </div>
              </div>

              {/* Admin: dropdown wyboru konta */}
              {role === "ADMIN" && (
                <div style={{ position: "relative" }}>
                  <select
                    id="history-user-select"
                    value={selectedHistoryUserId ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedHistoryUserId(val ? Number(val) : null);
                    }}
                    style={{
                      padding: "7px 30px 7px 12px",
                      borderRadius: 8,
                      border: `1px solid ${cBorder}`,
                      background: cBg,
                      color: cText,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                      WebkitAppearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                    }}
                  >
                    <option value="">Moje rozmowy</option>
                    {aiChatUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.role}) — {u.message_count} wiad.
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Przycisk zamknij */}
              <button
                onClick={() => { setShowHistory(false); setSelectedHistoryUserId(null); clearHistoryFilters(); }}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  border: `1px solid ${cBorder}`,
                  background: "transparent",
                  color: cFaint, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? "#1e1e1e" : "#f1f5f9"; e.currentTarget.style.color = cText; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = cFaint; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ── Pasek wyszukiwania i filtrów ── */}
            <div style={{
              flexShrink: 0, padding: "12px 24px",
              borderBottom: `1px solid ${cBorder}`,
              background: isDark ? "#0d0d0d" : "#f8fafc",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Wyszukiwanie po słowach */}
              <div style={{ position: "relative" }}>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={cFaint} strokeWidth="2"
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="history-search-input"
                  type="text"
                  placeholder="Szukaj w wiadomościach…"
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "9px 14px 9px 34px",
                    borderRadius: 10,
                    border: `1px solid ${historySearchQuery ? cAccent : cBorder}`,
                    background: cSurface,
                    color: cText,
                    fontSize: 12,
                    fontWeight: 500,
                    outline: "none",
                    transition: "border-color 0.2s",
                    fontFamily: 'inherit',
                  }}
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery("")}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      width: 20, height: 20, borderRadius: "50%",
                      border: "none",
                      background: isDark ? "#333" : "#e2e8f0",
                      color: cFaint, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800,
                    }}
                  >✕</button>
                )}
              </div>

              {/* Filtry daty */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, color: cFaint, fontWeight: 600, whiteSpace: "nowrap" }}>Od:</label>
                  <input
                    id="history-date-from"
                    type="date"
                    value={historyDateFrom}
                    onChange={e => setHistoryDateFrom(e.target.value)}
                    style={{
                      padding: "6px 10px", borderRadius: 8,
                      border: `1px solid ${historyDateFrom ? cAccent : cBorder}`,
                      background: cSurface, color: cText,
                      fontSize: 11, fontWeight: 500,
                      outline: "none", fontFamily: "inherit",
                      cursor: "pointer",
                      colorScheme: isDark ? "dark" : "light",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, color: cFaint, fontWeight: 600, whiteSpace: "nowrap" }}>Do:</label>
                  <input
                    id="history-date-to"
                    type="date"
                    value={historyDateTo}
                    onChange={e => setHistoryDateTo(e.target.value)}
                    style={{
                      padding: "6px 10px", borderRadius: 8,
                      border: `1px solid ${historyDateTo ? cAccent : cBorder}`,
                      background: cSurface, color: cText,
                      fontSize: 11, fontWeight: 500,
                      outline: "none", fontFamily: "inherit",
                      cursor: "pointer",
                      colorScheme: isDark ? "dark" : "light",
                    }}
                  />
                </div>

                {/* Przycisk wyczyść filtry */}
                {hasActiveFilters && (
                  <button
                    onClick={clearHistoryFilters}
                    style={{
                      marginLeft: "auto",
                      padding: "5px 12px", borderRadius: 8,
                      border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "#fecaca"}`,
                      background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2",
                      color: isDark ? "#f87171" : "#dc2626",
                      fontSize: 11, fontWeight: 700,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                      transition: "all 0.15s",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Wyczyść filtry
                  </button>
                )}
              </div>
            </div>

            {/* Treść historii */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem",
              display: "flex", flexDirection: "column", gap: "0.75rem",
              background: cBg,
            }}>
              {aiHistoryLoading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: cFaint, fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                  Ładowanie historii…
                </div>
              ) : aiHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem", color: cFaint }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📭</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Brak historii</div>
                  <div style={{ fontSize: 12 }}>Nie ma jeszcze żadnych rozmów z Doradcą AI</div>
                </div>
              ) : filteredAiHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem", color: cFaint }}>
                  <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.5 }}>🔍</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Brak wyników</div>
                  <div style={{ fontSize: 12, marginBottom: 14 }}>Nie znaleziono wiadomości pasujących do filtrów</div>
                  <button
                    onClick={clearHistoryFilters}
                    style={{
                      padding: "7px 18px", borderRadius: 8,
                      border: `1px solid ${cBorder}`,
                      background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)",
                      color: cPrimary, fontSize: 12, fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >Wyczyść filtry</button>
                </div>
              ) : (
                <>
                  {/* Separator daty */}
                  {(() => {
                    let lastDate = "";
                    return filteredAiHistory.map(msg => {
                      const date = new Date(msg.timestamp).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" });
                      const showDate = date !== lastDate;
                      lastDate = date;
                      const parsed = parseHistoryContent(msg.content, msg.role);
                      const isHtml = /<[a-z]/.test(parsed);

                      // Podświetlanie szukanej frazy
                      function highlightText(text: string): string {
                        if (!historySearchQuery.trim()) return text;
                        const q = historySearchQuery.trim();
                        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                        return text.replace(regex, `<mark style="background:${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.25)'};color:inherit;border-radius:2px;padding:0 1px">$1</mark>`);
                      }

                      const displayContent = historySearchQuery.trim()
                        ? highlightText(isHtml ? parsed : parsed.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                        : null;

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div style={{
                              textAlign: "center", margin: "12px 0 8px",
                              fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "0.15em", color: cFaint,
                            }}>
                              <span style={{
                                background: cSurface, border: `1px solid ${cBorder}`,
                                padding: "4px 14px", borderRadius: 100,
                              }}>{date}</span>
                            </div>
                          )}
                          <div className={msg.role === "user" ? "bbr" : "bbl"}
                            style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}
                          >
                            {msg.role === "ai" && (
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0,
                              }}>AI</div>
                            )}
                            <div style={{ maxWidth: "80%" }}>
                              <div style={{
                                background: msg.role === "user" ? cPrimary : cCard,
                                border: msg.role === "ai" ? `1px solid ${cBorder}` : "none",
                                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                padding: "10px 14px",
                              }}>
                                {displayContent ? (
                                  <p style={{ margin: 0, fontSize: 13, color: msg.role === "user" ? "#fff" : cText, lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{ __html: displayContent }} />
                                ) : isHtml ? (
                                  <p style={{ margin: 0, fontSize: 13, color: msg.role === "user" ? "#fff" : cText, lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{ __html: parsed }} />
                                ) : (
                                  <p style={{ margin: 0, fontSize: 13, color: msg.role === "user" ? "#fff" : cText, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                    {parsed}
                                  </p>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: cFaint, marginTop: 2, textAlign: msg.role === "user" ? "right" : "left", padding: "0 4px" }}>
                                {msg.role === "user" ? "Ty" : "SmartLoad AI"} · {new Date(msg.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div ref={historyEndRef} />
                </>
              )}
            </div>

            {/* Footer historii */}
            <div style={{
              flexShrink: 0, padding: "12px 24px",
              borderTop: `1px solid ${cBorder}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: cSurface,
            }}>
              <div style={{ fontSize: 11, color: cFaint }}>
                {hasActiveFilters
                  ? `${filteredAiHistory.length} z ${aiHistory.length} wiadomości`
                  : (aiHistory.length > 0 ? `${aiHistory.length} wiadomości` : "")}
              </div>
              <button
                onClick={() => { setShowHistory(false); setSelectedHistoryUserId(null); clearHistoryFilters(); }}
                style={{
                  padding: "8px 20px", borderRadius: 8,
                  border: `1px solid ${cBorder}`,
                  background: "transparent",
                  color: cText, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? "#1e1e1e" : "#f1f5f9"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
