import { Chrome, Github } from "lucide-react";

import { SubmitButton } from "@/components/auth/submit-button";
import { startOAuthAction } from "@/app/auth/actions";

type SupportedOAuthProvider = "google" | "github";

const PROVIDER_META: Record<
  "google" | "github",
  { label: string; icon: typeof Chrome }
> = {
  google: {
    label: "Continue with Google",
    icon: Chrome,
  },
  github: {
    label: "Continue with GitHub",
    icon: Github,
  },
};

type OAuthButtonsProps = {
  providers: string[];
  nextPath: string;
  source: "/auth/sign-in" | "/auth/sign-up";
};

export function OAuthButtons({
  providers,
  nextPath,
  source,
}: OAuthButtonsProps) {
  const supportedProviders = providers.filter(
    (provider): provider is SupportedOAuthProvider =>
      provider === "google" || provider === "github"
  );

  if (supportedProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {supportedProviders.map((provider) => {
        const meta = PROVIDER_META[provider];
        const Icon = meta.icon;

        return (
          <form key={provider} action={startOAuthAction}>
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="source" value={source} />
            <SubmitButton
              type="submit"
              variant="outline"
              className="h-11 w-full justify-center"
              pendingLabel="Connecting..."
            >
              <Icon className="mr-2 h-4 w-4" />
              {meta.label}
            </SubmitButton>
          </form>
        );
      })}
    </div>
  );
}
