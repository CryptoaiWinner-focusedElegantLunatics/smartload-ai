"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Pusher from "pusher-js";

export interface ChatMsg {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  timestamp: string;
  is_read: boolean;
}

interface UsePusherChatOptions {
  onMessage?: (msg: ChatMsg) => void;
  onConnected?: (userId: number) => void;
  onError?: (msg: string) => void;
}

/**
 * Hook czatu P2P oparty na Pusher Channels.
 * - Subskrybuje `private-user-{myId}` i nasłuchuje eventów `new-message`.
 * - Wysyłanie przez REST POST `/api/chat/send`.
 * - Brak raw WebSocket — Pusher obsługuje transport, reconnect, heartbeat.
 */
export function usePusherChat({
  onMessage,
  onConnected,
  onError,
}: UsePusherChatOptions) {
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [myId, setMyId] = useState<number | null>(null);

  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const pusherRef = useRef<Pusher | null>(null);

  // Pobierz myId z /api/me
  useEffect(() => {
    fetch("/api/backend/api/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setMyId(data.id);
          onConnectedRef.current?.(data.id);
        }
      })
      .catch(() => {});
  }, []);

  // Inicjalizacja Pusher gdy mamy myId
  useEffect(() => {
    if (!myId) return;

    const authUrl = "/api/backend/api/pusher/auth";

    const pusher = new Pusher("bd08de491433f589a091", {
      cluster: "eu",
      // Custom authorizer — jedyny sposób na wysłanie cookies (withCredentials)
      authorizer: (channel) => ({
        authorize: (socketId, callback) => {
          fetch(authUrl, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channel.name)}`,
          })
            .then(r => {
              if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
              return r.json();
            })
            .then(data => callback(null, data))
            .catch(err => callback(err, null as any));
        },
      }),
    });

    pusherRef.current = pusher;

    pusher.connection.bind("connected", () => {
      console.log("[Pusher] Połączono ✓");
      setStatus("online");
    });
    pusher.connection.bind("disconnected", () => {
      console.warn("[Pusher] Rozłączono — Pusher sam się zreconnectuje");
      setStatus("offline");
    });
    pusher.connection.bind("error", (err: any) => {
      console.error("[Pusher] Błąd:", err);
    });

    // Subskrybuj prywatny kanał
    const channelName = `private-user-${myId}`;
    console.log(`[Pusher] Subskrybuję: ${channelName}`);
    const channel = pusher.subscribe(channelName);

    channel.bind("pusher:subscription_succeeded", () => {
      console.log(`[Pusher] Subskrypcja OK ✓`);
    });

    channel.bind("pusher:subscription_error", (err: any) => {
      console.error(`[Pusher] Błąd subskrypcji:`, err);
      onErrorRef.current?.("Błąd autoryzacji Pusher");
    });

    // Nasłuchuj wiadomości
    channel.bind("new-message", (data: ChatMsg) => {
      console.log("[Pusher] Nowa wiadomość:", data);
      onMessageRef.current?.(data);
    });

    channel.bind("message-sent", (data: ChatMsg) => {
      console.log("[Pusher] Echo wysłanej:", data);
      onMessageRef.current?.(data);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
      pusherRef.current = null;
    };
  }, [myId]);

  // Wysyłanie przez REST POST
  const sendMessage = useCallback(async (receiverId: number, content: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/backend/api/chat/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: receiverId, content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onErrorRef.current?.(err.detail || `Błąd ${res.status}`);
        return false;
      }

      // Backend zwraca zapisaną wiadomość — dodaj ją lokalnie jako "swoją"
      const msg: ChatMsg = await res.json();
      onMessageRef.current?.(msg);
      return true;
    } catch {
      onErrorRef.current?.("Brak połączenia z serwerem");
      return false;
    }
  }, []);

  return { status, sendMessage, myId };
}
