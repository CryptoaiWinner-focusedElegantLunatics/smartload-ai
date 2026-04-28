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

    ws.onerror = (error) => {
      console.error("[P2P WS] Błąd połączenia:", error);
      setStatus("offline");
    };

    ws.onclose = (event) => {
      setStatus("offline");
      console.warn("[P2P WS] Zamknięto połączenie:", event.code, event.reason);
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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onError?.("Brak połączenia z serwerem P2P. Spróbuj ponownie za chwilę.");
      return false;
    }
    const payload = JSON.stringify({ receiver_id: receiverId, content });
    console.log("[P2P WS] sending:", payload);
    wsRef.current.send(payload);
    return true;
  }, [onError]);

  return { status, sendMessage };
}
