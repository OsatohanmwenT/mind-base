import "server-only";

import type { UserSchema } from "@insforge/sdk";
import { cache } from "react";
import { headers } from "next/headers";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";

export type PublicAuthConfig = {
  requireEmailVerification: boolean;
  passwordMinLength: number;
  requireNumber: boolean;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireSpecialChar: boolean;
  verifyEmailMethod: "code" | "link";
  resetPasswordMethod: "code" | "link";
  oAuthProviders: string[];
};

const FALLBACK_AUTH_CONFIG: PublicAuthConfig = {
  requireEmailVerification: true,
  passwordMinLength: 6,
  requireNumber: false,
  requireLowercase: false,
  requireUppercase: false,
  requireSpecialChar: false,
  verifyEmailMethod: "code",
  resetPasswordMethod: "code",
  oAuthProviders: ["github", "google"],
};

export async function resolveAppOrigin() {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

export async function getCurrentUser(): Promise<UserSchema | null> {
  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return null;
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export const getPublicAuthConfig = cache(async () => {
  try {
    const insforge = createInsforgeServerClient();
    const { data, error } = await insforge.auth.getPublicAuthConfig();

    if (error || !data) {
      return FALLBACK_AUTH_CONFIG;
    }

    return data;
  } catch {
    return FALLBACK_AUTH_CONFIG;
  }
});
