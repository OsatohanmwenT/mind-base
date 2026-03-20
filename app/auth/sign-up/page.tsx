import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getNextPathFromSearchParam } from "@/lib/auth/redirects";
import { getCurrentUser, getPublicAuthConfig } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [user, authConfig] = await Promise.all([
    getCurrentUser(),
    getPublicAuthConfig(),
  ]);

  if (user) {
    redirect("/notes");
  }

  const nextPath = getNextPathFromSearchParam(params.next);
  const email = typeof params.email === "string" ? params.email : "";
  const verifyMode =
    typeof params.mode === "string" && params.mode === "verify";

  return (
    <AuthShell
      eyebrow="Create Account"
      title="Set up your workspace"
      description="Create your account, verify the 6-digit email code on the same screen, and land directly in `/notes` once the session is established."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      {authConfig.verifyEmailMethod !== "code" ? (
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          This project is currently configured for link-based email verification,
          so the code-based sign-up flow has been disabled.
        </div>
      ) : (
        <div className="space-y-6">
          <OAuthButtons
            providers={authConfig.oAuthProviders}
            nextPath={nextPath}
            source="/auth/sign-up"
          />

          {authConfig.oAuthProviders.length > 0 ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="bg-background px-3">or use email</span>
              </div>
            </div>
          ) : null}

          <SignUpForm
            nextPath={nextPath}
            initialEmail={email}
            startInVerifyMode={verifyMode && email.length > 0}
            passwordMinLength={authConfig.passwordMinLength}
          />
        </div>
      )}
    </AuthShell>
  );
}
