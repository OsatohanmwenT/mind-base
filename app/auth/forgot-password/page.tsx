import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUser, getPublicAuthConfig } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps) {
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
      title="Send a reset code"
      description="We use code-based password reset for this project. Enter your email and we’ll send the 6-digit code if the account exists."
      footer={
        <Link
          href="/auth/sign-in"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {authConfig.resetPasswordMethod !== "code" ? (
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          This project is currently configured for link-based password reset, so
          the code-based reset flow has been disabled.
        </div>
      ) : (
        <ForgotPasswordForm initialEmail={email} />
      )}
    </AuthShell>
  );
}
