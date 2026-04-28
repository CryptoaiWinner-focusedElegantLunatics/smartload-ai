"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "SPEDYTOR" | "KIEROWCA" | null;

interface AuthState {
  username: string | null;
  role: UserRole;
  vehiclePlate: string | null;
  isLoading: boolean;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  username: null,
  role: null,
  vehiclePlate: null,
  isLoading: true,
  logout: () => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "logout" | "refreshAuth">>({
    username: null,
    role: null,
    vehiclePlate: null,
    isLoading: true,
  });

  const logout = () => {
    setState({
      username: null,
      role: null,
      vehiclePlate: null,
      isLoading: false,
    });
  };

  const refreshAuth = async () => {
    try {
      const res = await fetch("/api/backend/api/me", { credentials: "include" });
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
    }
  };

  useEffect(() => {
    refreshAuth();
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
