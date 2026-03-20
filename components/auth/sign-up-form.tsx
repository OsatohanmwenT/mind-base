"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SignUpActionState } from "@/app/auth/actions";
import { signUpFlowAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignUpFormProps = {
  nextPath: string;
  initialEmail?: string;
  initialName?: string;
  startInVerifyMode?: boolean;
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

export function SignUpForm({
  nextPath,
  initialEmail = "",
  initialName = "",
  startInVerifyMode = false,
  passwordMinLength,
}: SignUpFormProps) {
  const initialState: SignUpActionState = {
    step: startInVerifyMode ? "verify" : "credentials",
    email: initialEmail,
    name: initialName,
    next: nextPath,
    error: null,
    message: startInVerifyMode
      ? `Enter the 6-digit code sent to ${initialEmail}.`
      : null,
  };

  const [state, action] = useActionState(signUpFlowAction, initialState);

  return (
    <div className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {!state.error && state.message ? (
        <Notice tone="message">{state.message}</Notice>
      ) : null}

      {state.step === "credentials" ? (
        <form action={action} className="space-y-5">
          <input type="hidden" name="intent" value="sign-up" />
          <input type="hidden" name="next" value={state.next} />

          <div className="space-y-2">
            <Label htmlFor="sign-up-name">Name</Label>
            <Input
              id="sign-up-name"
              name="name"
              autoComplete="name"
              defaultValue={state.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sign-up-email">Email</Label>
            <Input
              id="sign-up-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sign-up-password">Password</Label>
            <Input
              id="sign-up-password"
              name="password"
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
            pendingLabel="Creating account..."
          >
            Create account
          </SubmitButton>
        </form>
      ) : (
        <div className="space-y-5">
          <form action={action} className="space-y-5">
            <input type="hidden" name="intent" value="verify-email" />
            <input type="hidden" name="email" value={state.email} />
            <input type="hidden" name="name" value={state.name} />
            <input type="hidden" name="next" value={state.next} />

            <div className="space-y-2">
              <Label htmlFor="sign-up-otp">Verification code</Label>
              <Input
                id="sign-up-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
              />
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to {state.email}.
              </p>
            </div>

            <SubmitButton
              type="submit"
              size="lg"
              className="h-11 w-full"
              pendingLabel="Verifying..."
            >
              Verify email
            </SubmitButton>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row">
            <form action={action} className="flex-1">
              <input type="hidden" name="intent" value="resend-verification" />
              <input type="hidden" name="email" value={state.email} />
              <input type="hidden" name="name" value={state.name} />
              <input type="hidden" name="next" value={state.next} />
              <SubmitButton
                type="submit"
                variant="outline"
                className="h-11 w-full"
                pendingLabel="Sending..."
              >
                Resend code
              </SubmitButton>
            </form>

            <Link
              href={`/auth/sign-up?next=${encodeURIComponent(state.next)}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Start over
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
