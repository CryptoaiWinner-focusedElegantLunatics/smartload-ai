"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Zamknij sidebar przy zmianie strony
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Zablokuj scroll body gdy sidebar otwarty na mobile
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function toggleTheme() {
    setIsDark((prev) => !prev);
  }

  async function handleLogout() {
    await fetch("/api/backend/logout", { credentials: "include" });
    router.push("/login");
  }

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard Główny",
      gradient: "linear-gradient(135deg, #60a5fa, #2563eb)",
      icon: (
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="white"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: "/mail",
      label: "Poczta AI",
      gradient: "linear-gradient(135deg, #a78bfa, #7c3aed)",
      icon: (
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="white"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      href: "/chat",
      label: "Komunikator",
      gradient: "linear-gradient(135deg, #34d399, #059669)",
      badge: (
        <span
          style={{
            width: 8,
            height: 8,
            background: "#10b981",
            borderRadius: "50%",
            animation: "pulse 2s infinite",
            marginLeft: "auto",
          }}
        />
      ),
      icon: (
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="white"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      href: "/compare",
      label: "Porównywarka",
      gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      icon: (
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="white"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 16s3-3 3-8V4h-7v4h-3V4H2v4c0 5 3 8 3 8m2 0v4h10v-4m-5-8v8"
          />
        </svg>
      ),
    },
  ];

  const bg = isDark ? "#111111" : "#ffffff";
  const border = isDark ? "#252525" : "#e2e8f0";
  const textColor = isDark ? "#e8e8e8" : "#334155";
  const mutedColor = isDark ? "#888888" : "#94a3b8";
  const cardBg = isDark ? "#191919" : "#f8fafc";

  const sidebarContent = (
    <aside
      style={{
        width: 256,
        minWidth: 256,
        maxWidth: 256,
        height: "100vh",
        background: bg,
        borderRight: `1px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        fontFamily: '"Inter", system-ui, sans-serif',
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px",
          borderBottom: `1px solid ${border}`,
          background: bg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              flexShrink: 0,
              background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
            }}
          >
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.2,
                background: "linear-gradient(135deg, #3b82f6, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SmartLoad AI
            </div>
            <div
              style={{
                fontSize: 10,
                color: mutedColor,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Transport Suite
            </div>
          </div>
          {/* X button — tylko na mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="sidebar-close-btn"
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${border}`,
              background: "transparent",
              color: mutedColor,
              cursor: "pointer",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: "12px",
          background: bg,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: mutedColor,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            padding: "8px 12px",
          }}
        >
          Moduły
        </div>

        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: isActive ? "10px 9px" : "10px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive ? (isDark ? "#60a5fa" : "#3b82f6") : textColor,
                background: isActive
                  ? isDark
                    ? "rgba(59,130,246,0.15)"
                    : "rgba(59,130,246,0.08)"
                  : "transparent",
                borderLeft: isActive
                  ? `3px solid ${isDark ? "#60a5fa" : "#3b82f6"}`
                  : "3px solid transparent",
                transition: "background 0.15s",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: 8,
                  background: item.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
              {item.badge}
            </Link>
          );
        })}

        <div
          style={{
            fontSize: 10,
            color: mutedColor,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            padding: "16px 12px 8px",
          }}
        >
          System
        </div>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            color: textColor,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.04)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: cardBg,
              border: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke={mutedColor}
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span style={{ flex: 1 }}>API Docs</span>
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke={mutedColor}
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </nav>

      {/* Bottom */}
      <div
        style={{
          padding: "12px",
          borderTop: `1px solid ${border}`,
          background: bg,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: isDark ? "rgba(5,150,105,0.15)" : "#f0fdf4",
            border: `1px solid ${isDark ? "rgba(5,150,105,0.3)" : "#bbf7d0"}`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: "#10b981",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: isDark ? "#34d399" : "#059669",
              fontWeight: 600,
            }}
          >
            System Online
          </span>
        </div>

        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: cardBg,
            border: `1px solid ${border}`,
            cursor: "pointer",
            width: "100%",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 36,
              height: 20,
              background: isDark ? "#2563eb" : "#cbd5e1",
              borderRadius: 10,
              flexShrink: 0,
              transition: "background 0.3s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: isDark ? 18 : 2,
                width: 16,
                height: 16,
                background: "white",
                borderRadius: "50%",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.25s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: textColor,
              flex: 1,
              textAlign: "left",
            }}
          >
            {isDark ? "Tryb Ciemny" : "Tryb Jasny"}
          </span>
          <span style={{ fontSize: 16 }}>{isDark ? "🌙" : "☀️"}</span>
        </button>
        {/* Ustawienia — zastąp gołe <a href="/settings"> tym: */}
        <Link
          href="/settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            color:
              pathname === "/settings"
                ? isDark
                  ? "#60a5fa"
                  : "#3b82f6"
                : textColor,
            background:
              pathname === "/settings"
                ? isDark
                  ? "rgba(59,130,246,0.15)"
                  : "rgba(59,130,246,0.08)"
                : "transparent",
            borderLeft:
              pathname === "/settings"
                ? `3px solid ${isDark ? "#60a5fa" : "#3b82f6"}`
                : "3px solid transparent",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.04)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background =
              pathname === "/settings"
                ? isDark
                  ? "rgba(59,130,246,0.15)"
                  : "rgba(59,130,246,0.08)"
                : "transparent")
          }
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: cardBg,
              border: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={mutedColor}
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
          <span style={{ flex: 1 }}>Ustawienia</span>
        </Link>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = isDark
              ? "rgba(239,68,68,0.1)"
              : "#fef2f2")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              background: isDark ? "rgba(239,68,68,0.2)" : "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke={isDark ? "#f87171" : "#dc2626"}
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? "#f87171" : "#dc2626",
            }}
          >
            Wyloguj
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

        /* Hamburger — widoczny tylko na mobile */
        .sidebar-hamburger {
          display: none;
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 500;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid ${border};
          background: ${bg};
          cursor: pointer;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        /* Desktop — sidebar normalnie w layoucie */
        .sidebar-desktop { display: flex !important; position: static !important; }
        .sidebar-overlay  { display: none !important; }

        @media (max-width: 768px) {
          .sidebar-hamburger { display: flex; }
          .sidebar-close-btn { display: flex !important; }

          /* Sidebar schowany domyślnie, wysuwa się jako drawer */
          .sidebar-desktop {
            display: flex !important;
            position: fixed !important;
            top: 0; left: 0;
            height: 100vh;
            z-index: 400;
            transform: translateX(${isOpen ? "0" : "-100%"});
            transition: transform 0.25s ease;
            box-shadow: ${isOpen ? "4px 0 24px rgba(0,0,0,0.25)" : "none"};
          }

          /* Overlay przyciemniający */
          .sidebar-overlay {
            display: ${isOpen ? "block" : "none"} !important;
            position: fixed;
            inset: 0;
            z-index: 399;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
          }
        }
      `}</style>

      {/* Hamburger button */}
      <button
        className="sidebar-hamburger"
        onClick={() => setIsOpen(true)}
        aria-label="Otwórz menu"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={textColor}
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay */}
      <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />

      {/* Sidebar */}
      <div className="sidebar-desktop">{sidebarContent}</div>
    </>
  );
}
