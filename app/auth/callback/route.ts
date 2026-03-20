import { NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookiesOnResponse,
  clearOAuthPkceVerifierOnResponse,
  clearPostAuthRedirectOnResponse,
  setAuthCookiesOnResponse,
} from "@/lib/auth/cookies";
import { AUTH_COOKIE_NAMES, DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";
import { buildSignInPath, sanitizeNextPath } from "@/lib/auth/redirects";
import { createInsforgeServerClient } from "@/lib/insforge/server";

function buildErrorResponse(request: NextRequest, nextPath: string) {
  const redirectUrl = new URL(buildSignInPath(nextPath), request.url);
  redirectUrl.searchParams.set("error", "oauth_callback_failed");

  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookiesOnResponse(response);
  clearOAuthPkceVerifierOnResponse(response);
  clearPostAuthRedirectOnResponse(response);

  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const providerError = request.nextUrl.searchParams.get("error");
  const codeVerifier =
    request.cookies.get(AUTH_COOKIE_NAMES.oauthPkceVerifier)?.value ?? null;
  const postAuthRedirect = sanitizeNextPath(
    request.cookies.get(AUTH_COOKIE_NAMES.postAuthRedirect)?.value,
    DEFAULT_AUTH_REDIRECT
  );

  if (!code || providerError || !codeVerifier) {
    return buildErrorResponse(request, postAuthRedirect);
  }

  const insforge = createInsforgeServerClient();
  const { data, error } = await insforge.auth.exchangeOAuthCode(
    code,
    codeVerifier
  );

  if (error || !data?.accessToken || !data.refreshToken) {
    return buildErrorResponse(request, postAuthRedirect);
  }

  const destination = sanitizeNextPath(
    postAuthRedirect || data.redirectTo,
    DEFAULT_AUTH_REDIRECT
  );
  const response = NextResponse.redirect(new URL(destination, request.url));

  setAuthCookiesOnResponse(response, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  clearOAuthPkceVerifierOnResponse(response);
  clearPostAuthRedirectOnResponse(response);

  return response;
}
