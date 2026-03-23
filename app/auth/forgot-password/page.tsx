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
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your email and we’ll send you a code to get back in."
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
        <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Code-based password reset is not available at the moment.
        </div>
      ) : (
        <ForgotPasswordForm initialEmail={email} />
      )}
    </AuthShell>
  );
}
