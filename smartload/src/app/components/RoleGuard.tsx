"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "./AuthContext";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  /** Ścieżka przekierowania przy braku uprawnień. Default: /dashboard */
  redirectTo?: string;
}

/**
 * RoleGuard — bariera ról dla stron "use client".
 *
 * Użycie wewnątrz komponentu strony:
 *   <RoleGuard allowedRoles={["ADMIN", "SPEDYTOR"]}>
 *     <PageContent />
 *   </RoleGuard>
 *
 * Podczas ładowania pokazuje spinner.
 * Przy braku uprawnień — przekierowuje i nic nie renderuje.
 */
export default function RoleGuard({ allowedRoles, children, redirectTo = "/dashboard" }: RoleGuardProps) {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role !== null && !allowedRoles.includes(role)) {
      router.replace(redirectTo);
    }
  }, [isLoading, role, allowedRoles, redirectTo, router]);

  // Ładowanie — spinner
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0a0a",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid #3b82f6",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 12, color: "#555", fontFamily: "Inter, sans-serif" }}>
          Weryfikacja uprawnień…
        </span>
      </div>
    );
  }

  // Brak uprawnień — nic nie renderuj (redirect w useEffect)
  if (role !== null && !allowedRoles.includes(role)) {
    return null;
  }

  // Niezalogowany (role === null po załadowaniu) — też nic
  if (role === null) {
    return null;
  }

  return <>{children}</>;
}
