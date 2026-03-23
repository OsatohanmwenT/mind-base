import Link from "next/link";
import { LogOut, Plus } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export function WorkspaceHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Notes
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your private engineering knowledge vault.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-[13px]"
          asChild
        >
          <Link href="/notes/new">
            <Plus className="h-3.5 w-3.5" />
            New note
          </Link>
        </Button>
        <ModeToggle />
        <form action={signOutAction}>
          <SubmitButton
            type="submit"
            variant="secondary"
            pendingLabel="Signing out…"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}
