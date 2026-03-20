"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { SignInActionState } from "@/app/auth/actions";
import { signInAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInFormProps = {
  nextPath: string;
  initialEmail?: string;
  initialMessage?: string | null;
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

export function SignInForm({
  nextPath,
  initialEmail = "",
  initialMessage = null,
}: SignInFormProps) {
  const initialState: SignInActionState = {
    email: initialEmail,
    next: nextPath,
    error: null,
    message: initialMessage,
  };

  const [state, action] = useActionState(signInAction, initialState);

  return (
    <div className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {!state.error && state.message ? (
        <Notice tone="message">{state.message}</Notice>
      ) : null}

      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={state.next} />

        <div className="space-y-2">
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sign-in-password">Password</Label>
            <Link
              href={`/auth/forgot-password?email=${encodeURIComponent(
                state.email
              )}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <SubmitButton
          type="submit"
          size="lg"
          className="h-11 w-full"
          pendingLabel="Signing in..."
        >
          Log in
        </SubmitButton>
      </form>
    </div>
  );
}
