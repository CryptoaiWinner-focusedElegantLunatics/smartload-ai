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
 *
 * WAŻNE: Callbacki trzymane w refach, żeby `connect` nie zależał od nich
 * i nie powodował nieskończonej pętli reconnect przy każdym renderze.
 */
export function useChatWebSocket({
  onMessage,
  onConnected,
  onError,
}: UseChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");

  // ── Trzymamy callbacki w refach, żeby connect() był STABILNY ──
  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const connect = useCallback(() => {
    // Nie twórz nowego połączenia jeśli jest w toku lub otwarte
    if (wsRef.current && (
      wsRef.current.readyState === WebSocket.OPEN ||
      wsRef.current.readyState === WebSocket.CONNECTING
    )) return;

    setStatus("connecting");

    // Dynamiczny adres WebSocketa wspierający środowisko lokalne i produkcyjne (HTTPS -> WSS)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    let wsUrl = "";
    if (apiUrl) {
      wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/user-chat";
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/user-chat`;
    }

    console.log("[P2P WS] Próba połączenia z:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[P2P WS] Połączono!");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatMsg & { type: string; message?: string; user_id?: number };

        if (data.type === "connected") {
          setStatus("online");
          console.log("[P2P WS] authenticated as user", data.user_id);
          onConnectedRef.current?.(data.user_id ?? 0);
        } else if (data.type === "error") {
          console.warn("[P2P WS] server error:", data.message);
          onErrorRef.current?.(data.message ?? "Błąd WebSocket");
        } else if (data.type === "message" || data.type === "sent") {
          onMessageRef.current?.(data as ChatMsg);
        }
      } catch {
        console.error("[P2P WS] cannot parse:", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("[P2P WS] Błąd połączenia:", error);
      setStatus("offline");
    };

    ws.onclose = (event) => {
      setStatus("offline");
      console.warn("[P2P WS] Zamknięto połączenie:", event.code, event.reason);
      // Jeśli serwer wyrzuci za brak autoryzacji — nie próbuj ponownie
      if (event.code === 1008) return;
      reconnectTimer.current = setTimeout(() => connect(), 5000);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // PUSTE ZALEŻNOŚCI — connect jest stabilne, callbacki w refach

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendMessage = useCallback((receiverId: number, content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onErrorRef.current?.("Brak połączenia z serwerem P2P. Spróbuj ponownie za chwilę.");
      return false;
    }
    console.log("Wysyłam do receiver_id:", receiverId);
    const payload = JSON.stringify({ receiver_id: receiverId, content });
    console.log("[P2P WS] sending:", payload);
    wsRef.current.send(payload);
    return true;
  }, []);

  return { status, sendMessage };
}

