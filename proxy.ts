import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAMES, DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";
import { buildSignInPath, sanitizeNextPath } from "@/lib/auth/redirects";

function isProtectedPath(pathname: string) {
  return pathname === "/notes" || pathname.startsWith("/notes/");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return atob(padded);
}

function isJwtStale(token: string) {
  const parts = token.split(".");

  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: number };

    if (typeof payload.exp !== "number") {
      return false;
    }

    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const requestedPath = sanitizeNextPath(
    `${pathname}${search}`,
    DEFAULT_AUTH_REDIRECT
  );
  const accessToken =
    request.cookies.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
  const refreshToken =
    request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null;

  if (accessToken && !isJwtStale(accessToken)) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshUrl = request.nextUrl.clone();
    refreshUrl.pathname = "/auth/refresh";
    refreshUrl.search = `?next=${encodeURIComponent(requestedPath)}`;
    return NextResponse.redirect(refreshUrl);
  }

  const signInUrl = new URL(buildSignInPath(requestedPath), request.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/notes/:path*"],
};
