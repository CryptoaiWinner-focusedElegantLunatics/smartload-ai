import { NextRequest, NextResponse } from "next/server";

function extractToken(raw?: string): string | null {
  if (!raw) return null;
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

const PROTECTED = [
  "/dashboard",
  "/mail",
  "/chat",
  "/loads",
  "/my-routes",
  "/compare",
  "/settings",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname.startsWith("/login");
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  const rawCookie = req.cookies.get("access_token")?.value;
  const token = extractToken(rawCookie);
  const valid = isTokenValid(token);

  // Chroniona trasa bez ważnego tokenu → na login
  if (isProtected && !valid) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("access_token");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Login z ważnym tokenem → na dashboard (już zalogowany)
  if (isLoginPage && valid) {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = NextResponse.next();

  // Zakaz cache'owania chronionych stron
  if (isProtected) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/mail/:path*",
    "/chat/:path*",
    "/loads/:path*",
    "/my-routes/:path*",
    "/compare/:path*",
    "/settings/:path*",
    "/login",
  ],
};
