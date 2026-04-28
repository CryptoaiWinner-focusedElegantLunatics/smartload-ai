"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface ChatMsg {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  timestamp: string;
  is_read: boolean;
  type?: "message" | "sent" | "connected" | "error" | "notification";
}

interface UseChatWebSocketOptions {
  onMessage?: (msg: ChatMsg) => void;
  onConnected?: (userId: number) => void;
  onError?: (msg: string) => void;
}

/**
 * Hook do czatu user-to-user.
 * Cookie httponly jest wysyłane automatycznie przez przeglądarkę przy WS handshake.
 */
export function useChatWebSocket({
  onMessage,
  onConnected,
  onError,
}: UseChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");

  const connect = useCallback(() => {
    // Nie twórz nowego połączenia jeśli jest w toku lub otwarte
    if (wsRef.current && (
      wsRef.current.readyState === WebSocket.OPEN ||
      wsRef.current.readyState === WebSocket.CONNECTING
    )) return;

    setStatus("connecting");
    const ws = new WebSocket("ws://localhost:8000/ws/user-chat");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[P2P WS] connected ✓");
      // Cookie httponly wysyłane automatycznie
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatMsg & { type: string; message?: string; user_id?: number };

        if (data.type === "connected") {
          setStatus("online");
          console.log("[P2P WS] authenticated as user", data.user_id);
          onConnected?.(data.user_id ?? 0);
        } else if (data.type === "error") {
          console.warn("[P2P WS] server error:", data.message);
          onError?.(data.message ?? "Błąd WebSocket");
        } else if (data.type === "message" || data.type === "sent") {
          onMessage?.(data as ChatMsg);
        }
      } catch {
        console.error("[P2P WS] cannot parse:", event.data);
      }
    };

    ws.onerror = () => {
      // WS error events zawsze logują się jako pusty {} - to normalne zachowanie przeglądarki
      console.warn("[P2P WS] connection error — sprawdź czy backend działa na :8000");
      setStatus("offline");
    };

    ws.onclose = (e) => {
      setStatus("offline");
      console.log(`[P2P WS] closed (code=${e.code}), reconnect in 5s...`);
      reconnectTimer.current = setTimeout(() => connect(), 5000);
    };
  }, [onConnected, onError, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendMessage = useCallback((receiverId: number, content: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      onError?.("Brak połączenia z serwerem P2P.");
      return false;
    }
    const payload = JSON.stringify({ receiver_id: receiverId, content });
    console.log("[P2P WS] sending:", payload);
    wsRef.current.send(payload);
    return true;
  }, [onError]);

  return { status, sendMessage };
}
