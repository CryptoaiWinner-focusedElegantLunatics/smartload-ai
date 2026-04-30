"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "SPEDYTOR" | "KIEROWCA" | null;

interface AuthState {
  username: string | null;
  role: UserRole;
  vehiclePlate: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState>({
  username: null,
  role: null,
  vehiclePlate: null,
  isLoading: true,
  logout: async () => {},
  refreshAuth: async () => false,
});

const PROTECTED_PATHS = [
  "/dashboard",
  "/mail",
  "/chat",
  "/loads",
  "/my-routes",
  "/compare",
  "/settings",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    username: null as string | null,
    role: null as UserRole,
    vehiclePlate: null as string | null,
    isLoading: true,
  });

  const refreshAuth = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/backend/api/me", {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) throw new Error("Unauthenticated");

      const data = await res.json();
      setState({
        username: data.username ?? null,
        role: data.role ?? null,
        vehiclePlate: data.vehicle_plate ?? null,
        isLoading: false,
      });
      return true;
    } catch {
      setState({
        username: null,
        role: null,
        vehiclePlate: null,
        isLoading: false,
      });

      // Redirect tylko z chronionych tras, nie z landing page
      if (typeof window !== "undefined") {
        const isProtected = PROTECTED_PATHS.some((p) =>
          window.location.pathname.startsWith(p),
        );
        if (isProtected) window.location.replace("/login");
      }
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch("/api/backend/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      // ignoruj błąd sieci — wylogowujemy lokalnie i tak
    } finally {
      setState({
        username: null,
        role: null,
        vehiclePlate: null,
        isLoading: false,
      });
      window.location.replace("/login");
    }
  };

  useEffect(() => {
    refreshAuth();

    // Sprawdź sesję gdy użytkownik wraca do zakładki
    const onFocus = () => refreshAuth();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
