"use client";

import { useEffect, useState } from "react";

interface Driver {
  id: number;
  username: string;
  vehicle_plate: string | null;
}

interface AssignDriverModalProps {
  loadingCity: string;
  unloadingCity: string;
  weightKg?: number;
  price?: number;
  sourceId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AssignDriverModal({
  loadingCity,
  unloadingCity,
  weightKg = 0,
  price = 0,
  sourceId,
  onClose,
  onSuccess,
}: AssignDriverModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | "">("");
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/api/drivers", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Brak uprawnień lub błąd serwera.");
        return r.json();
      })
      .then(setDrivers)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoadingDrivers(false));
  }, []);

  async function handleAssign() {
    if (!selectedDriverId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/backend/api/routes/assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: selectedDriverId,
          source_id: sourceId ?? null,
          loading_city: loadingCity,
          unloading_city: unloadingCity,
          weight_kg: weightKg,
          price: price,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Błąd serwera (${res.status})`);
      }

      setToast("✓ Trasa przypisana do kierowcy!");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 1000,
          width: "min(480px, 95vw)",
          background: "var(--modal-bg, #1a1a2e)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          animation: "slideUp 0.25s ease",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -46%) } to { opacity: 1; transform: translate(-50%, -50%) } }
          .assign-select {
            width: 100%; padding: 10px 14px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
            color: #e8e8e8; font-size: 14px; font-weight: 500; outline: none;
            transition: border-color 0.2s; cursor: pointer;
          }
          .assign-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
          .assign-select option { background: #1a1a2e; color: #e8e8e8; }
          .btn-assign {
            width: 100%; padding: 12px; border-radius: 10px; border: none;
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
            transition: all 0.2s; box-shadow: 0 4px 16px rgba(59,130,246,0.35);
          }
          .btn-assign:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(59,130,246,0.45); }
          .btn-assign:disabled { opacity: 0.55; cursor: not-allowed; }
          .toast-msg {
            position: absolute; bottom: -56px; left: 50%; transform: translateX(-50%);
            background: #10b981; color: #fff; padding: 10px 20px; border-radius: 100px;
            font-size: 13px; font-weight: 700; white-space: nowrap;
            box-shadow: 0 8px 24px rgba(16,185,129,0.4); animation: slideUp 0.3s ease;
          }
        `}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6366f1", marginBottom: 4 }}>
              Dyspozytornia
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.02em" }}>
              Przypisz Kierowcę
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#94a3b8", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>

        {/* Trasa info */}
        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>
              {loadingCity} → {unloadingCity}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {weightKg > 0 && `${weightKg.toLocaleString("pl-PL")} kg`}
              {weightKg > 0 && price > 0 && "  ·  "}
              {price > 0 && `${price.toLocaleString("pl-PL", { minimumFractionDigits: 0 })} EUR`}
            </span>
          </div>
        </div>

        {/* Select kierowcy */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: 8 }}>
          Wybierz Kierowcę
        </label>

        {isLoadingDrivers ? (
          <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13 }}>Ładowanie kierowców…</div>
        ) : drivers.length === 0 ? (
          <div style={{ padding: "12px 0", color: "#f87171", fontSize: 13 }}>Brak dostępnych kierowców w systemie.</div>
        ) : (
          <select
            className="assign-select"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(Number(e.target.value) || "")}
          >
            <option value="">— Wybierz kierowcę —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.username}{d.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}
              </option>
            ))}
          </select>
        )}

        {/* Info o wybranym */}
        {selectedDriver && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, fontSize: 12, color: "#34d399" }}>
            ✓ {selectedDriver.username}
            {selectedDriver.vehicle_plate && ` — ${selectedDriver.vehicle_plate}`}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Anuluj
          </button>
          <button
            className="btn-assign"
            style={{ flex: 2 }}
            disabled={!selectedDriverId || isSubmitting}
            onClick={handleAssign}
          >
            {isSubmitting ? "Przypisuję…" : "Przypisz Trasę →"}
          </button>
        </div>

        {toast && <div className="toast-msg">{toast}</div>}
      </div>
    </>
  );
}
