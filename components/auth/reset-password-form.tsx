"use client";

import { useActionState } from "react";

import type { ResetPasswordActionState } from "@/app/auth/actions";
import { resetPasswordFlowAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetPasswordFormProps = {
  initialEmail?: string;
  passwordMinLength: number;
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

export function ResetPasswordForm({
  initialEmail = "",
  passwordMinLength,
}: ResetPasswordFormProps) {
  const initialState: ResetPasswordActionState = {
    step: "code",
    email: initialEmail,
    error: null,
    message: null,
  };

  const [state, action] = useActionState(
    resetPasswordFlowAction,
    initialState
  );

  return (
    <div className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {!state.error && state.message ? (
        <Notice tone="message">{state.message}</Notice>
      ) : null}

      {state.step === "code" ? (
        <form action={action} className="space-y-5">
          <input type="hidden" name="intent" value="exchange-reset-code" />

          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-code">Reset code</Label>
            <Input
              id="reset-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              required
            />
          </div>

          <SubmitButton
            type="submit"
            size="lg"
            className="h-11 w-full"
            pendingLabel="Verifying code..."
          >
            Continue
          </SubmitButton>
        </form>
      ) : (
        <form action={action} className="space-y-5">
          <input type="hidden" name="intent" value="complete-reset-password" />
          <input type="hidden" name="email" value={state.email} />

          <div className="space-y-2">
            <Label htmlFor="reset-new-password">New password</Label>
            <Input
              id="reset-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            <p className="text-sm text-muted-foreground">
              Use at least {passwordMinLength} characters.
            </p>
          </div>

          <SubmitButton
            type="submit"
            size="lg"
            className="h-11 w-full"
            pendingLabel="Updating password..."
          >
            Save new password
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
