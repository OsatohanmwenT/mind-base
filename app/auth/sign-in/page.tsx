import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/sign-in-form";
import {
  getNextPathFromSearchParam,
} from "@/lib/auth/redirects";
import { getCurrentUser, getPublicAuthConfig } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSignInMessage(
  errorCode: string | undefined,
  resetState: string | undefined
) {
  if (resetState === "success") {
    return "Password updated. Sign in with your new password.";
  }

  switch (errorCode) {
    case "oauth_callback_failed":
      return "Sign-in failed. Please try again or use email and password.";
    case "oauth_start_failed":
      return "Unable to sign in right now. Please try again.";
    case "oauth_provider_unavailable":
      return "That sign-in method is not available.";
    default:
      return null;
  }
}

export default async function SignInPage({ searchParams }: PageProps) {
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
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const resetState = typeof params.reset === "string" ? params.reset : undefined;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your vault"
      description="Pick up where you left off."
      footer={
        <>
          Need an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <OAuthButtons
          providers={authConfig.oAuthProviders}
          nextPath={nextPath}
          source="/auth/sign-in"
        />

        {authConfig.oAuthProviders.length > 0 ? (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-background px-3">or</span>
            </div>
          </div>
        ) : null}

        <SignInForm
          nextPath={nextPath}
          initialEmail={email}
          initialMessage={getSignInMessage(errorCode, resetState)}
        />
      </div>
    </AuthShell>
  );
}
