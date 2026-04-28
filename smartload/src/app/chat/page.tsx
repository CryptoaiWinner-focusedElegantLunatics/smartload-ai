"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../components/AuthContext";
import { usePusherChat, ChatMsg } from "../hooks/usePusherChat";

// ── Types ──
interface Contact { id: number; username: string; role: string; }

interface OfferCard {
  id: string; route_from: string; route_to: string;
  price: string; weight: string;
}
interface AiMsg {
  id: number;
  role: "ai" | "user";
  text: string;
  time: string;
  offerCards?: OfferCard[];
  selectedOfferIdx?: number;       // która karta jest wybrana
  offerState?: "pending" | "accepted" | "rejected";
  isHtml?: boolean;
}

function now() {
  return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

// ── Parse AI response ──
function parseAiResponse(raw: string): { text: string; offerCards?: OfferCard[]; isHtml?: boolean } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const p = JSON.parse(trimmed);
      if (p.type === "offer_card") {
        // Tablica "offers" (nowa) lub "offer" (stary fallback)
        const cards: OfferCard[] = p.offers ?? (p.offer ? [p.offer] : []);
        return { text: p.message || "Znalazłem oferty!", offerCards: cards.length > 0 ? cards : undefined };
      }
    } catch { /* not JSON */ }
  }
  const isHtml = /<[a-z]/.test(trimmed);
  return { text: trimmed, isHtml };
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
  const [aiTyping, setAiTyping] = useState(false);
  const aiWsRef = useRef<WebSocket | null>(null);
  const aiMsgId = useRef(1);

  const connectAiWs = useCallback(() => {
    const ws = aiWsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    // TWARDE SPRAWDZANIE: Gdzie jesteśmy odpaleni?
    let baseUrl = "";
    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost") {
        // Jeśli testujesz u siebie na kompie, bijemy do Twojego lokalnego Pythona
        baseUrl = "ws://localhost:8000";
      } else {
        // Jeśli apka wisi na Railway, bijemy do chmury
        baseUrl = "wss://smartload-ai-production-01c5.up.railway.app";
      }
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
    const wsUrl = token ? `${baseUrl}/ws/chat?token=${token}` : `${baseUrl}/ws/chat`;

    const newWs = new WebSocket(wsUrl);
    aiWsRef.current = newWs;

    newWs.onopen = () => console.log("[AI WS] connected ✓");
    newWs.onmessage = (e) => {
      setAiTyping(false);
      const { text, offerCards, isHtml } = parseAiResponse(e.data);
      setAiMessages(prev => [...prev, {
        id: aiMsgId.current++, role: "ai", text, time: now(),
        offerCards,
        offerState: offerCards ? "pending" : undefined,
        isHtml,
      }]);
    };
    newWs.onclose = (e) => {
      console.log(`[AI WS] closed (code=${e.code}), reconnect in 5s...`);

      // Jeśli serwer wyrzuci nas za brak autoryzacji - zatrzymujemy pętlę mielenia
      if (e.code === 1008) return;

      setTimeout(connectAiWs, 5000);
    };
    newWs.onerror = () => {
      console.warn("[AI WS] connection error — backend niedostępny?");
    };
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
                <div><div style={{ fontSize: 14, fontWeight: 700, color: cText }}>SmartLoad Spedytor AI</div><div style={{ fontSize: 11, color: cFaint }}>Asystent — szuka ładunków</div></div>
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
    </>
  );
}
