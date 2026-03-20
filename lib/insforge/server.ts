import "server-only";

import { createClient, type InsForgeClient } from "@insforge/sdk";

function getEnv(name: "NEXT_PUBLIC_INSFORGE_URL" | "INSFORGE_ANON_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createInsforgeServerClient(
  accessToken?: string
): InsForgeClient {
  return createClient({
    baseUrl: getEnv("NEXT_PUBLIC_INSFORGE_URL"),
    anonKey: getEnv("INSFORGE_ANON_KEY"),
    isServerMode: true,
    edgeFunctionToken: accessToken,
  });
}
