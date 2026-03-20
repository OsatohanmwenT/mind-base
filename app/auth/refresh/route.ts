import { NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookiesOnResponse,
  setAuthCookiesOnResponse,
} from "@/lib/auth/cookies";
import { AUTH_COOKIE_NAMES, DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";
import { buildSignInPath, sanitizeNextPath } from "@/lib/auth/redirects";
import { createInsforgeServerClient } from "@/lib/insforge/server";

function buildSignInResponse(request: NextRequest, nextPath: string) {
  const redirectUrl = new URL(buildSignInPath(nextPath), request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookiesOnResponse(response);
  return response;
}

export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(
    request.nextUrl.searchParams.get("next"),
    DEFAULT_AUTH_REDIRECT
  );
  const refreshToken =
    request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null;

  if (!refreshToken) {
    return buildSignInResponse(request, nextPath);
  }

  const insforge = createInsforgeServerClient();
  const { data, error } = await insforge.auth.refreshSession({ refreshToken });

  if (error || !data?.accessToken) {
    return buildSignInResponse(request, nextPath);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  setAuthCookiesOnResponse(response, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
  });

  return response;
}
