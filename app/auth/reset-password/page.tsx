import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser, getPublicAuthConfig } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [user, authConfig] = await Promise.all([
    getCurrentUser(),
    getPublicAuthConfig(),
  ]);

  if (user) {
    redirect("/notes");
  }

  const email = typeof params.email === "string" ? params.email : "";

  return (
    <AuthShell
      eyebrow="Password Reset"
      title="Verify your reset code"
      description="Exchange the email reset code on the server, then set a new password without exposing reset tokens to client code."
      footer={
        <Link
          href={`/auth/forgot-password?email=${encodeURIComponent(email)}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Need a new code?
        </Link>
      }
    >
      {authConfig.resetPasswordMethod !== "code" ? (
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          This project is currently configured for link-based password reset, so
          the code-based reset flow has been disabled.
        </div>
      ) : (
        <ResetPasswordForm
          initialEmail={email}
          passwordMinLength={authConfig.passwordMinLength}
        />
      )}
    </AuthShell>
  );
}
