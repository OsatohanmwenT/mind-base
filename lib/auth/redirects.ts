import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";

export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getNextPathFromSearchParam(
  value: string | string[] | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return sanitizeNextPath(candidate, fallback);
}

export function buildSignInPath(nextPath?: string | null) {
  const safeNextPath = sanitizeNextPath(nextPath, DEFAULT_AUTH_REDIRECT);
  const params = new URLSearchParams();
  params.set("next", safeNextPath);
  return `/auth/sign-in?${params.toString()}`;
}
