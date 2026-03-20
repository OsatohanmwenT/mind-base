"use server";

import type { InsForgeError } from "@insforge/sdk";
import { redirect } from "next/navigation";

import {
  clearAuthCookies,
  clearResetPasswordTokenCookie,
  readAuthCookies,
  readResetPasswordTokenCookie,
  setAuthCookies,
  setOAuthPkceVerifierCookie,
  setPostAuthRedirectCookie,
  setResetPasswordTokenCookie,
} from "@/lib/auth/cookies";
import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import {
  getPublicAuthConfig,
  resolveAppOrigin,
} from "@/lib/auth/session";
import { createInsforgeServerClient } from "@/lib/insforge/server";

type SupportedOAuthProvider = "google" | "github";

type ActionNotice = {
  error: string | null;
  message: string | null;
};

export type SignInActionState = ActionNotice & {
  email: string;
  next: string;
};

export type SignUpActionState = ActionNotice & {
  step: "credentials" | "verify";
  email: string;
  name: string;
  next: string;
};

export type ForgotPasswordActionState = ActionNotice & {
  email: string;
  submitted: boolean;
};

export type ResetPasswordActionState = ActionNotice & {
  step: "code" | "password";
  email: string;
};

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readPassword(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function readNextPath(value: FormDataEntryValue | null) {
  return sanitizeNextPath(readString(value), DEFAULT_AUTH_REDIRECT);
}

function buildAuthEntryPath(options: {
  source?: string | null;
  next?: string | null;
  error?: string;
  email?: string;
  mode?: "verify";
  reset?: "success";
}) {
  const source =
    options.source === "/auth/sign-up" ? "/auth/sign-up" : "/auth/sign-in";
  const params = new URLSearchParams();

  params.set("next", sanitizeNextPath(options.next, DEFAULT_AUTH_REDIRECT));

  if (options.error) {
    params.set("error", options.error);
  }

  if (options.email) {
    params.set("email", options.email);
  }

  if (options.mode) {
    params.set("mode", options.mode);
  }

  if (options.reset) {
    params.set("reset", options.reset);
  }

  return `${source}?${params.toString()}`;
}

function requireSessionTokens(
  tokens: { accessToken?: string | null; refreshToken?: string | null },
  fallbackMessage: string
) {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error(fallbackMessage);
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

function getFriendlyAuthError(
  error: InsForgeError | null,
  fallback: string
) {
  if (!error) {
    return fallback;
  }

  if (error.statusCode === 429) {
    return "Too many attempts. Try again in a moment.";
  }

  return error.message || fallback;
}

export async function signInAction(
  _previousState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> {
  const email = readString(formData.get("email")).toLowerCase();
  const password = readPassword(formData.get("password"));
  const next = readNextPath(formData.get("next"));

  if (!email || !password) {
    return {
      email,
      next,
      error: "Enter both your email and password.",
      message: null,
    };
  }

  const insforge = createInsforgeServerClient();
  const { data, error } = await insforge.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.statusCode === 403) {
      redirect(
        buildAuthEntryPath({
          source: "/auth/sign-up",
          mode: "verify",
          email,
          next,
        })
      );
    }

    return {
      email,
      next,
      error:
        error.statusCode === 401
          ? "Invalid email or password."
          : getFriendlyAuthError(error, "Unable to sign in right now."),
      message: null,
    };
  }

  try {
    const tokens = requireSessionTokens(
      {
        accessToken: data?.accessToken,
        refreshToken: data?.refreshToken,
      },
      "Sign in succeeded, but the session response was incomplete."
    );

    await setAuthCookies(tokens);
  } catch (sessionError) {
    return {
      email,
      next,
      error:
        sessionError instanceof Error
          ? sessionError.message
          : "Unable to save your session.",
      message: null,
    };
  }

  redirect(next);
}

export async function signUpFlowAction(
  previousState: SignUpActionState,
  formData: FormData
): Promise<SignUpActionState> {
  const intent = readString(formData.get("intent"));
  const email = readString(formData.get("email")).toLowerCase();
  const name = readString(formData.get("name"));
  const next = readNextPath(formData.get("next"));
  const config = await getPublicAuthConfig();

  if (config.verifyEmailMethod !== "code") {
    return {
      ...previousState,
      email,
      name,
      next,
      error:
        "This project is no longer configured for code-based email verification.",
      message: null,
    };
  }

  if (intent === "verify-email") {
    const otp = readString(formData.get("otp"));

    if (!email || otp.length !== 6) {
      return {
        step: "verify",
        email,
        name,
        next,
        error: "Enter the 6-digit verification code from your email.",
        message: null,
      };
    }

    const insforge = createInsforgeServerClient();
    const { data, error } = await insforge.auth.verifyEmail({
      email,
      otp,
    });

    if (error) {
      return {
        step: "verify",
        email,
        name,
        next,
        error:
          error.statusCode === 400
            ? "That code is invalid or has expired."
            : getFriendlyAuthError(
                error,
                "Unable to verify your email right now."
              ),
        message: null,
      };
    }

    try {
      const tokens = requireSessionTokens(
        {
          accessToken: data?.accessToken,
          refreshToken: data?.refreshToken,
        },
        "Verification succeeded, but the session response was incomplete."
      );

      await setAuthCookies(tokens);
    } catch (sessionError) {
      return {
        step: "verify",
        email,
        name,
        next,
        error:
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to save your session.",
        message: null,
      };
    }

    redirect(next);
  }

  if (intent === "resend-verification") {
    if (!email) {
      return {
        step: "verify",
        email,
        name,
        next,
        error: "Enter your email again to resend the verification code.",
        message: null,
      };
    }

    const insforge = createInsforgeServerClient();
    const { error } = await insforge.auth.resendVerificationEmail({ email });

    return {
      step: "verify",
      email,
      name,
      next,
      error: error
        ? getFriendlyAuthError(error, "Unable to resend the code right now.")
        : null,
      message: error
        ? null
        : `A fresh verification code was sent to ${email}.`,
    };
  }

  const password = readPassword(formData.get("password"));

  if (!name || !email || !password) {
    return {
      step: "credentials",
      email,
      name,
      next,
      error: "Enter your name, email, and password to continue.",
      message: null,
    };
  }

  if (password.length < config.passwordMinLength) {
    return {
      step: "credentials",
      email,
      name,
      next,
      error: `Use at least ${config.passwordMinLength} characters for your password.`,
      message: null,
    };
  }

  const insforge = createInsforgeServerClient();
  const { data, error } = await insforge.auth.signUp({
    name,
    email,
    password,
  });

  if (error) {
    const duplicateEmail =
      error.statusCode === 409 ||
      /already exists|already registered/i.test(error.message);

    return {
      step: "credentials",
      email,
      name,
      next,
      error: duplicateEmail
        ? "An account with that email already exists."
        : getFriendlyAuthError(error, "Unable to create your account."),
      message: null,
    };
  }

  if (data?.requireEmailVerification) {
    return {
      step: "verify",
      email,
      name,
      next,
      error: null,
      message: `Enter the 6-digit code we sent to ${email}.`,
    };
  }

  try {
    const tokens = requireSessionTokens(
      {
        accessToken: data?.accessToken,
        refreshToken: data?.refreshToken,
      },
      "Sign up succeeded, but the session response was incomplete."
    );

    await setAuthCookies(tokens);
  } catch (sessionError) {
    return {
      step: "credentials",
      email,
      name,
      next,
      error:
        sessionError instanceof Error
          ? sessionError.message
          : "Unable to save your session.",
      message: null,
    };
  }

  redirect(next);
}

export async function forgotPasswordAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const email = readString(formData.get("email")).toLowerCase();
  const config = await getPublicAuthConfig();

  if (config.resetPasswordMethod !== "code") {
    return {
      email,
      submitted: false,
      error:
        "This project is no longer configured for code-based password reset.",
      message: null,
    };
  }

  if (!email) {
    return {
      email,
      submitted: false,
      error: "Enter the email address tied to your account.",
      message: null,
    };
  }

  const insforge = createInsforgeServerClient();
  const { error } = await insforge.auth.sendResetPasswordEmail({ email });

  if (error && error.statusCode >= 500) {
    return {
      email,
      submitted: false,
      error: "Unable to send a reset code right now. Try again shortly.",
      message: null,
    };
  }

  return {
    email,
    submitted: true,
    error: null,
    message:
      "If that email exists, we sent a 6-digit reset code and a link back to the reset screen.",
  };
}

export async function resetPasswordFlowAction(
  previousState: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const intent = readString(formData.get("intent"));
  const email = readString(formData.get("email")).toLowerCase();
  const config = await getPublicAuthConfig();

  if (config.resetPasswordMethod !== "code") {
    return {
      ...previousState,
      email,
      error:
        "This project is no longer configured for code-based password reset.",
      message: null,
    };
  }

  if (intent === "exchange-reset-code") {
    const code = readString(formData.get("code"));

    if (!email || code.length !== 6) {
      return {
        step: "code",
        email,
        error: "Enter your email and the 6-digit reset code.",
        message: null,
      };
    }

    const insforge = createInsforgeServerClient();
    const { data, error } = await insforge.auth.exchangeResetPasswordToken({
      email,
      code,
    });

    if (error || !data?.token) {
      return {
        step: "code",
        email,
        error:
          error?.statusCode === 400
            ? "That reset code is invalid or has expired."
            : getFriendlyAuthError(
                error,
                "Unable to verify that reset code right now."
              ),
        message: null,
      };
    }

    await setResetPasswordTokenCookie(data.token);

    return {
      step: "password",
      email,
      error: null,
      message: "Code accepted. Set a new password now.",
    };
  }

  const newPassword = readPassword(formData.get("newPassword"));

  if (!newPassword) {
    return {
      step: "password",
      email,
      error: "Enter a new password to finish resetting your account.",
      message: null,
    };
  }

  if (newPassword.length < config.passwordMinLength) {
    return {
      step: "password",
      email,
      error: `Use at least ${config.passwordMinLength} characters for your password.`,
      message: null,
    };
  }

  const resetToken = await readResetPasswordTokenCookie();

  if (!resetToken) {
    return {
      step: "code",
      email,
      error: "Your reset session expired. Enter the code again.",
      message: null,
    };
  }

  const insforge = createInsforgeServerClient();
  const { error } = await insforge.auth.resetPassword({
    newPassword,
    otp: resetToken,
  });

  if (error) {
    if (error.statusCode === 400) {
      return {
        step: "password",
        email,
        error: "Your new password does not meet the current password policy.",
        message: null,
      };
    }

    return {
      step: "password",
      email,
      error: getFriendlyAuthError(
        error,
        "Unable to reset your password right now."
      ),
      message: null,
    };
  }

  await clearResetPasswordTokenCookie();
  redirect(
    buildAuthEntryPath({
      source: "/auth/sign-in",
      email,
      reset: "success",
    })
  );
}

export async function startOAuthAction(formData: FormData) {
  const rawProvider = readString(formData.get("provider"));
  const next = readNextPath(formData.get("next"));
  const source = readString(formData.get("source"));
  const config = await getPublicAuthConfig();

  const allowedProviders = config.oAuthProviders.filter(
    (provider: string): provider is SupportedOAuthProvider =>
      provider === "google" || provider === "github"
  );

  if (!allowedProviders.includes(rawProvider as SupportedOAuthProvider)) {
    redirect(
      buildAuthEntryPath({
        source,
        next,
        error: "oauth_provider_unavailable",
      })
    );
  }

  const origin = await resolveAppOrigin();
  const insforge = createInsforgeServerClient();
  const { data, error } = await insforge.auth.signInWithOAuth({
    provider: rawProvider as SupportedOAuthProvider,
    redirectTo: `${origin}/auth/callback`,
    skipBrowserRedirect: true,
  });

  if (error || !data.url || !data.codeVerifier) {
    redirect(
      buildAuthEntryPath({
        source,
        next,
        error: "oauth_start_failed",
      })
    );
  }

  await setOAuthPkceVerifierCookie(data.codeVerifier);
  await setPostAuthRedirectCookie(next);
  redirect(data.url);
}

export async function signOutAction() {
  const { accessToken } = await readAuthCookies();

  try {
    const insforge = createInsforgeServerClient(accessToken ?? undefined);
    await insforge.auth.signOut();
  } finally {
    await clearAuthCookies();
  }

  redirect("/");
}
