import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,oklch(0.55_0.08_185_/_0.08),transparent_32%),linear-gradient(to_bottom,transparent,oklch(0.55_0.08_185_/_0.03))]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8">
        <div className="mb-10 flex items-center justify-between lg:col-start-2 lg:mb-0 lg:justify-end">
          <Link href="/" className="text-lg font-semibold tracking-tight lg:hidden">
            MindBase
          </Link>
          <ModeToggle />
        </div>

        <section className="hidden flex-col justify-between rounded-[32px] border border-border/60 bg-background/65 p-10 shadow-[0_24px_90px_-54px_rgba(0,0,0,0.45)] backdrop-blur-sm lg:flex">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              MindBase
            </Link>

            <div className="mt-16 space-y-6">
              <p className="font-mono text-xs uppercase tracking-[0.26em] text-muted-foreground">
                Authenticated workspace
              </p>
              <h2 className="max-w-md text-4xl font-semibold tracking-tight text-balance">
                Keep note capture public-facing and the workspace properly
                protected.
              </h2>
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                Sessions stay in first-party httpOnly cookies, auth mutations
                stay on the server, and `/notes` becomes the first protected
                destination after sign-in.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <ShieldCheck className="h-5 w-5 text-foreground" />
              <p className="mt-3 text-sm font-medium">Cookie-backed sessions</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Access and refresh tokens never touch client-readable storage.
              </p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <Sparkles className="h-5 w-5 text-foreground" />
              <p className="mt-3 text-sm font-medium">Server-first flows</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sign-up, verification, reset, sign-out, refresh, and OAuth all
                complete without exposing auth state to client components.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-1 items-center justify-center lg:col-start-2">
          {children}
        </div>
      </div>
    </main>
  );
}
