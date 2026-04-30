"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "SPEDYTOR" | "KIEROWCA" | null;

interface AuthState {
  username: string | null;
  role: UserRole;
  vehiclePlate: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  username: null,
  role: null,
  vehiclePlate: null,
  isLoading: true,
  logout: async () => {},
  refreshAuth: async () => {},
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
  const [state, setState] = useState<Omit<AuthState, "logout" | "refreshAuth">>(
    {
      username: null,
      role: null,
      vehiclePlate: null,
      isLoading: true,
    },
  );

  const logout = async () => {
    try {
      await fetch("/api/backend/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignoruj błąd sieci
    }
    setState({
      username: null,
      role: null,
      vehiclePlate: null,
      isLoading: false,
    });
    window.location.replace("/login");
  };

  const refreshAuth = async () => {
    try {
      const res = await fetch("/api/backend/api/me", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Unauthenticated");
      const data = await res.json();
      setState({
        username: data.username ?? null,
        role: data.role ?? null,
        vehiclePlate: data.vehicle_plate ?? null,
        isLoading: false,
      });
    } catch {
      setState({
        username: null,
        role: null,
        vehiclePlate: null,
        isLoading: false,
      });

      // ✅ Redirect tylko z chronionych stron — landing page "/" zostaje nieruszona
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
        if (isProtected) {
          window.location.replace("/login");
        }
      }
    }
  };

  useEffect(() => {
    refreshAuth();

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
