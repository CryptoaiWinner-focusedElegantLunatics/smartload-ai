"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";

// ── Types ──
interface OfferData {
  id: string;
  weight: string;
  price: string;
  route_from: string;
  route_to: string;
}

interface WsMessage {
  type: "offer_card" | "text";
  message: string;
  offer?: OfferData;
}

interface ChatMessage {
  id: number;
  role: "ai" | "driver";
  text: string;
  time: string;
  offerCard?: WsMessage;
  offerState?: "pending" | "accepted" | "rejected";
}

// ── Main component ──
export default function ChatPage() {
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

  // CSS vars
  const cBorder = isDark ? "#252525" : "#e2e8f0";
  const cBg = isDark ? "#0a0a0a" : "#f8fafc";
  const cSurface = isDark ? "#111111" : "#ffffff";
  const cCard = isDark ? "#161616" : "#ffffff";
  const cHover = isDark ? "#191919" : "#f1f5f9";
  const cText = isDark ? "#e8e8e8" : "#0f172a";
  const cMuted = isDark ? "#888888" : "#64748b";
  const cFaint = isDark ? "#555555" : "#94a3b8";
  const cPrimary = "#3b82f6";

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "ai",
      time: now(),
      text: "Cześć! 👋 Jestem Twoim asystentem spedycyjnym SmartLoad.\nPowiedz mi, w jakiej okolicy jesteś lub skąd szukasz ładunku — a ja sprawdzę co mamy dla Ciebie! 🚛",
    },
  ]);
  const [input, setInput] = useState("");
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "online" | "error" | "offline"
  >("connecting");
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const msgId = useRef(1);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function now() {
    return new Date().toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── WebSocket ──
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const proto =
      typeof window !== "undefined" && location.protocol === "https:"
        ? "wss"
        : "ws";
    const ws = new WebSocket(`${proto}://${location.hostname}:8000/ws/chat`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("online");
    ws.onmessage = (event) => {
      setIsTyping(false);
      let parsed: WsMessage | null = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {}

      if (parsed?.type === "offer_card") {
        setMessages((prev) => [
          ...prev,
          {
            id: msgId.current++,
            role: "ai",
            text: parsed!.message,
            time: now(),
            offerCard: parsed!,
            offerState: "pending",
          },
        ]);
      } else {
        const text =
          typeof event.data === "string" ? event.data : parsed?.message || "";
        setMessages((prev) => [
          ...prev,
          { id: msgId.current++, role: "ai", text, time: now() },
        ]);
      }
    };
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => {
      setWsStatus("offline");
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Send ──
  function sendMessage(forcedText?: string) {
    const text = forcedText || input.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [
      ...prev,
      { id: msgId.current++, role: "driver", text, time: now() },
    ]);
    wsRef.current.send(text);
    if (!forcedText) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
    setIsTyping(true);
  }

  function acceptOffer(msgId_: number) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId_ ? { ...m, offerState: "accepted" } : m)),
    );
    sendMessage("Przyjmuję, biorę to");
  }
  function rejectOffer(msgId_: number) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId_ ? { ...m, offerState: "rejected" } : m)),
    );
    sendMessage("Nie, szukaj następnej");
  }

  // ── Status helpers ──
  const statusColors: Record<string, string> = {
    online: "#22c55e",
    error: "#ef4444",
    offline: isDark ? "#555" : "#94a3b8",
    connecting: isDark ? "#555" : "#94a3b8",
  };
  const statusLabels: Record<string, string> = {
    online: "Połączony · gotowy",
    error: "Błąd połączenia",
    offline: "Rozłączono — ponawiam...",
    connecting: "Łączenie...",
  };
  function fixLinks(html: string) {
    return html.replace(
      /href="\/static\//g,
      'href="http://localhost:8000/static/',
    );
  }
  const dotColor = statusColors[wsStatus] ?? statusColors.connecting;
  const statusLabel = statusLabels[wsStatus] ?? "Łączenie...";

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        @keyframes slideInLeft  { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(12px);  } to { opacity:1; transform:translateX(0); } }
        @keyframes blink { 0%,80%,100% { opacity:.2; transform:scale(.8); } 40% { opacity:1; transform:scale(1); } }
        @keyframes offerPulse { 0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,.4); } 50% { box-shadow:0 0 0 6px rgba(59,130,246,0); } }
        .bubble-ai     { animation: slideInLeft  .22s ease; }
        .bubble-driver { animation: slideInRight .22s ease; }
        .typing-dot { width:7px; height:7px; border-radius:50%; background:${cFaint}; display:inline-block; animation:blink 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay:.2s; }
        .typing-dot:nth-child(3) { animation-delay:.4s; }
        .btn-accept-pulse { animation: offerPulse 2s infinite; }
        #chatMessages::-webkit-scrollbar { width:5px; }
        #chatMessages::-webkit-scrollbar-track { background:transparent; }
        #chatMessages::-webkit-scrollbar-thumb { background:${cFaint}; border-radius:3px; }
        .chat-textarea:focus { outline:none; }
        .chat-input-wrap:focus-within { border-color:${cPrimary}; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
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
                Komunikator Kierowcy
              </h2>
              <p style={{ fontSize: 12, color: cMuted, margin: 0 }}>
                Asystent spedycyjny AI w czasie rzeczywistym
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dotColor,
                  transition: "background .3s",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: cMuted }}>{statusLabel}</span>
            </div>
          </header>

          {/* ── AI agent bar ── */}
          <div
            style={{
              flexShrink: 0,
              background: cSurface,
              borderBottom: `1px solid ${cBorder}`,
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  boxShadow: "0 4px 12px rgba(59,130,246,.3)",
                }}
              >
                AI
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: dotColor,
                  border: `2px solid ${cSurface}`,
                  transition: "background .3s",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: cText }}>
                SmartLoad Spedytor AI
              </div>
              <div style={{ fontSize: 11, color: cFaint }}>{statusLabel}</div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 100,
                background: isDark ? "rgba(59,130,246,0.12)" : "#dbeafe",
                color: isDark ? "#60a5fa" : "#2563eb",
                border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`,
              }}
            >
              🚛 TSL
            </span>
          </div>

          {/* ── Messages ── */}
          <div
            id="chatMessages"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              background: cBg,
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "driver" ? (
                  <div
                    className="bubble-driver"
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "flex-end",
                      gap: 10,
                    }}
                  >
                    <div style={{ maxWidth: "75%" }}>
                      <div
                        style={{
                          background: cPrimary,
                          borderRadius: "18px 18px 4px 18px",
                          padding: "10px 16px",
                          boxShadow: "0 4px 12px rgba(59,130,246,.25)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#fff",
                            lineHeight: 1.6,
                          }}
                        >
                          {msg.text}
                        </p>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: cFaint,
                          marginTop: 3,
                          textAlign: "right",
                          marginRight: 4,
                        }}
                      >
                        Ty · {msg.time}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: isDark ? "#1e1e1e" : "#e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 17,
                        flexShrink: 0,
                      }}
                    >
                      🚛
                    </div>
                  </div>
                ) : msg.offerCard ? (
                  /* ── Offer card ── */
                  <div
                    className="bubble-ai"
                    style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      AI
                    </div>
                    <div style={{ maxWidth: "85%" }}>
                      <div
                        style={{
                          background: cCard,
                          border: `1px solid ${cBorder}`,
                          borderRadius: "18px 18px 18px 4px",
                          padding: "14px 16px",
                          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: cText,
                            lineHeight: 1.6,
                          }}
                          dangerouslySetInnerHTML={{
                            __html: fixLinks(msg.text),
                          }}
                        />
                        {msg.offerCard.offer && (
                          <div
                            style={{
                              background: isDark ? "#0d0d0d" : "#f8fafc",
                              border: `1px solid ${cBorder}`,
                              borderRadius: 12,
                              padding: "14px 16px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 12,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 13,
                                    color: cText,
                                  }}
                                >
                                  Ładunek {msg.offerCard.offer.id}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: cFaint,
                                    marginTop: 2,
                                  }}
                                >
                                  {msg.offerCard.offer.weight}
                                </div>
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: 15,
                                  color: cPrimary,
                                }}
                              >
                                {msg.offerCard.offer.price}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                                marginBottom: 14,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.15em",
                                    color: cFaint,
                                    marginBottom: 3,
                                  }}
                                >
                                  Załadunek
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: cText,
                                  }}
                                >
                                  📍 {msg.offerCard.offer.route_from}
                                </div>
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.15em",
                                    color: cFaint,
                                    marginBottom: 3,
                                  }}
                                >
                                  Rozładunek
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: cText,
                                  }}
                                >
                                  🏁 {msg.offerCard.offer.route_to}
                                </div>
                              </div>
                            </div>

                            {/* Buttons */}
                            {msg.offerState === "pending" && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  className="btn-accept-pulse"
                                  onClick={() => acceptOffer(msg.id)}
                                  style={{
                                    flex: 1,
                                    background: cPrimary,
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "10px 0",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ✅ Przyjmij i bookuj
                                </button>
                                <button
                                  onClick={() => rejectOffer(msg.id)}
                                  style={{
                                    flex: 1,
                                    background: "transparent",
                                    color: cMuted,
                                    border: `1px solid ${cBorder}`,
                                    borderRadius: 10,
                                    padding: "10px 0",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ❌ Odrzuć
                                </button>
                              </div>
                            )}
                            {msg.offerState === "accepted" && (
                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#22c55e",
                                  padding: "10px 0",
                                  background: isDark
                                    ? "rgba(34,197,94,0.1)"
                                    : "#f0fdf4",
                                  border: "1px solid rgba(34,197,94,0.3)",
                                  borderRadius: 10,
                                }}
                              >
                                ✅ Zaakceptowano — rezerwuję trasę...
                              </div>
                            )}
                            {msg.offerState === "rejected" && (
                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: cFaint,
                                  padding: "10px 0",
                                  background: isDark ? "#111" : "#f8fafc",
                                  border: `1px solid ${cBorder}`,
                                  borderRadius: 10,
                                }}
                              >
                                ❌ Odrzucono — szukam kolejnej oferty...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: cFaint,
                          marginTop: 3,
                          marginLeft: 4,
                        }}
                      >
                        SmartLoad AI · {msg.time}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Normal AI message ── */
                  <div
                    className="bubble-ai"
                    style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      AI
                    </div>
                    <div style={{ maxWidth: "75%" }}>
                      <div
                        style={{
                          background: cCard,
                          border: `1px solid ${cBorder}`,
                          borderRadius: "18px 18px 18px 4px",
                          padding: "10px 16px",
                          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: cText,
                            lineHeight: 1.6,
                          }}
                          dangerouslySetInnerHTML={{
                            __html: fixLinks(msg.text),
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: cFaint,
                          marginTop: 3,
                          marginLeft: 4,
                        }}
                      >
                        SmartLoad AI · {msg.time}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div
                className="bubble-ai"
                style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  AI
                </div>
                <div
                  style={{
                    background: cCard,
                    border: `1px solid ${cBorder}`,
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar ── */}
          <div
            style={{
              flexShrink: 0,
              background: cSurface,
              borderTop: `1px solid ${cBorder}`,
              padding: "14px 24px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                maxWidth: 860,
                margin: "0 auto",
              }}
            >
              <div
                className="chat-input-wrap"
                style={{
                  flex: 1,
                  background: cBg,
                  border: `1px solid ${cBorder}`,
                  borderRadius: 18,
                  padding: "10px 16px",
                  transition: "border-color .2s, box-shadow .2s",
                }}
              >
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  rows={1}
                  placeholder="Napisz wiadomość… (np. 'Jestem w Warszawie, mam miejsce na 24t')"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 128) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    fontSize: 13,
                    color: cText,
                    resize: "none",
                    outline: "none",
                    lineHeight: 1.6,
                    maxHeight: 128,
                    overflowY: "auto",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || wsStatus !== "online"}
                title="Wyślij (Ctrl+Enter)"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: "none",
                  flexShrink: 0,
                  background:
                    !input.trim() || wsStatus !== "online"
                      ? isDark
                        ? "#1e1e1e"
                        : "#e2e8f0"
                      : cPrimary,
                  color:
                    !input.trim() || wsStatus !== "online" ? cFaint : "#fff",
                  cursor:
                    !input.trim() || wsStatus !== "online"
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background .2s, color .2s",
                  boxShadow:
                    input.trim() && wsStatus === "online"
                      ? "0 4px 12px rgba(59,130,246,.35)"
                      : "none",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: cFaint }}>
                Enter — nowa linia &nbsp;·&nbsp; Ctrl+Enter — wyślij
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
