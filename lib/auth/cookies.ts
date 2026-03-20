import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { AUTH_COOKIE_NAMES } from "@/lib/auth/constants";

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
const OAUTH_PKCE_MAX_AGE = 60 * 10;
const POST_AUTH_REDIRECT_MAX_AGE = 60 * 10;
const RESET_PASSWORD_TOKEN_MAX_AGE = 60 * 15;

type WritableCookies = Pick<NextResponse["cookies"], "set">;

function createCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function createExpiredCookieOptions() {
  return {
    ...createCookieOptions(0),
    expires: new Date(0),
  };
}

function setCookie(
  store: WritableCookies,
  name: string,
  value: string,
  maxAge: number
) {
  store.set(name, value, createCookieOptions(maxAge));
}

function expireCookie(store: WritableCookies, name: string) {
  store.set(name, "", createExpiredCookieOptions());
}

export async function readAuthCookies() {
  const cookieStore = await cookies();

  return {
    accessToken: cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null,
    refreshToken:
      cookieStore.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null,
  };
}

export async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken?: string;
}) {
  const cookieStore = await cookies();
  setAuthCookiesOnStore(cookieStore, tokens);
}

export function setAuthCookiesOnResponse(
  response: NextResponse,
  tokens: {
    accessToken: string;
    refreshToken?: string;
  }
) {
  setAuthCookiesOnStore(response.cookies, tokens);
}

function setAuthCookiesOnStore(
  store: WritableCookies,
  tokens: {
    accessToken: string;
    refreshToken?: string;
  }
) {
  setCookie(
    store,
    AUTH_COOKIE_NAMES.accessToken,
    tokens.accessToken,
    ACCESS_TOKEN_MAX_AGE
  );

  if (tokens.refreshToken) {
    setCookie(
      store,
      AUTH_COOKIE_NAMES.refreshToken,
      tokens.refreshToken,
      REFRESH_TOKEN_MAX_AGE
    );
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  clearAuthCookiesOnStore(cookieStore);
}

export function clearAuthCookiesOnResponse(response: NextResponse) {
  clearAuthCookiesOnStore(response.cookies);
}

function clearAuthCookiesOnStore(store: WritableCookies) {
  expireCookie(store, AUTH_COOKIE_NAMES.accessToken);
  expireCookie(store, AUTH_COOKIE_NAMES.refreshToken);
  expireCookie(store, AUTH_COOKIE_NAMES.oauthPkceVerifier);
  expireCookie(store, AUTH_COOKIE_NAMES.postAuthRedirect);
  expireCookie(store, AUTH_COOKIE_NAMES.resetPasswordToken);
}

export async function setOAuthPkceVerifierCookie(codeVerifier: string) {
  const cookieStore = await cookies();
  setCookie(
    cookieStore,
    AUTH_COOKIE_NAMES.oauthPkceVerifier,
    codeVerifier,
    OAUTH_PKCE_MAX_AGE
  );
}

export function setOAuthPkceVerifierOnResponse(
  response: NextResponse,
  codeVerifier: string
) {
  setCookie(
    response.cookies,
    AUTH_COOKIE_NAMES.oauthPkceVerifier,
    codeVerifier,
    OAUTH_PKCE_MAX_AGE
  );
}

export async function readOAuthPkceVerifierCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAMES.oauthPkceVerifier)?.value ?? null;
}

export async function clearOAuthPkceVerifierCookie() {
  const cookieStore = await cookies();
  expireCookie(cookieStore, AUTH_COOKIE_NAMES.oauthPkceVerifier);
}

export function clearOAuthPkceVerifierOnResponse(response: NextResponse) {
  expireCookie(response.cookies, AUTH_COOKIE_NAMES.oauthPkceVerifier);
}

export async function setPostAuthRedirectCookie(nextPath: string) {
  const cookieStore = await cookies();
  setCookie(
    cookieStore,
    AUTH_COOKIE_NAMES.postAuthRedirect,
    nextPath,
    POST_AUTH_REDIRECT_MAX_AGE
  );
}

export async function readPostAuthRedirectCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAMES.postAuthRedirect)?.value ?? null;
}

export async function clearPostAuthRedirectCookie() {
  const cookieStore = await cookies();
  expireCookie(cookieStore, AUTH_COOKIE_NAMES.postAuthRedirect);
}

export function clearPostAuthRedirectOnResponse(response: NextResponse) {
  expireCookie(response.cookies, AUTH_COOKIE_NAMES.postAuthRedirect);
}

export async function setResetPasswordTokenCookie(token: string) {
  const cookieStore = await cookies();
  setCookie(
    cookieStore,
    AUTH_COOKIE_NAMES.resetPasswordToken,
    token,
    RESET_PASSWORD_TOKEN_MAX_AGE
  );
}

export async function readResetPasswordTokenCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAMES.resetPasswordToken)?.value ?? null;
}

export async function clearResetPasswordTokenCookie() {
  const cookieStore = await cookies();
  expireCookie(cookieStore, AUTH_COOKIE_NAMES.resetPasswordToken);
}
