"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "SPEDYTOR" | "KIEROWCA" | null;

interface AuthState {
  username: string | null;
  role: UserRole;
  vehiclePlate: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState>({
  username: null,
  role: null,
  vehiclePlate: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    username: null,
    role: null,
    vehiclePlate: null,
    isLoading: true,
  });

  useEffect(() => {
    fetch("/api/backend/api/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then((data) => {
        setState({
          username: data.username ?? null,
          role: data.role ?? null,
          vehiclePlate: data.vehicle_plate ?? null,
          isLoading: false,
        });
      })
      .catch(() => {
        setState({ username: null, role: null, vehiclePlate: null, isLoading: false });
      });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
