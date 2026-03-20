"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ForgotPasswordActionState } from "@/app/auth/actions";
import { forgotPasswordAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

function Notice({
  tone,
  children,
}: {
  tone: "error" | "message";
  children: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-muted/50 text-foreground"
      }`}
    >
      {children}
    </div>
  );
}

export function ForgotPasswordForm({
  initialEmail = "",
}: ForgotPasswordFormProps) {
  const initialState: ForgotPasswordActionState = {
    email: initialEmail,
    submitted: false,
    error: null,
    message: null,
  };

  const [state, action] = useActionState(forgotPasswordAction, initialState);

  return (
    <div className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {!state.error && state.message ? (
        <Notice tone="message">{state.message}</Notice>
      ) : null}

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="forgot-password-email">Email</Label>
          <Input
            id="forgot-password-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
          />
        </div>

        <SubmitButton
          type="submit"
          size="lg"
          className="h-11 w-full"
          pendingLabel="Sending code..."
        >
          Send reset code
        </SubmitButton>
      </form>

      {state.submitted ? (
        <Link
          href={`/auth/reset-password?email=${encodeURIComponent(state.email)}`}
          className="inline-flex w-full items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          I have a reset code
        </Link>
      ) : null}
    </div>
  );
}
