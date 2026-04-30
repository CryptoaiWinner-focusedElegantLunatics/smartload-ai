import { NextRequest, NextResponse } from "next/server";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest) {
  const rawCookie = req.cookies.get("access_token")?.value;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  const token = rawCookie?.startsWith("Bearer ")
    ? rawCookie.slice(7)
    : rawCookie;

  const isValidToken = !!token && !isTokenExpired(token);

  if (!isValidToken && !isLoginPage) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("access_token");
    // ✅ Zakaz cache'owania odpowiedzi redirectu
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (isValidToken && isLoginPage) {
    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // ✅ Dla chronionych stron — zakaz cache przy każdym przejściu
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
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
