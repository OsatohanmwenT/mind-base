import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, NotebookPen } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { buildSignInPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NotesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildSignInPath("/notes"));
  }

  const displayName = user.profile?.name || user.email;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.08),transparent_30%)] px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-background/85 p-6 shadow-[0_24px_90px_-54px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Protected Route
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Notes workspace
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Signed in as {displayName}. This is the first authenticated shell
              wired to the InsForge cookie-backed session.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="h-11 px-4">
              <Link href="/">Back to home</Link>
            </Button>
            <form action={signOutAction}>
              <SubmitButton
                type="submit"
                variant="secondary"
                className="h-11 px-4"
                pendingLabel="Signing out..."
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </SubmitButton>
            </form>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-border/70 bg-background/80 p-6">
            <NotebookPen className="h-5 w-5 text-foreground" />
            <h2 className="mt-4 text-lg font-medium">Auth checks completed</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Middleware blocks unauthenticated entry, the page resolves the
              current user from the access token cookie, and sign-out clears the
              local session before sending you back to the landing page.
            </p>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/80 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Next step
            </p>
            <h2 className="mt-4 text-lg font-medium">
              Real note data can plug in here next
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The app now has a protected route boundary and a shared auth layer
              that future note features can reuse without moving tokens into
              client components.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
