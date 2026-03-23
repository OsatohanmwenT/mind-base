"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewNoteHeaderProps {
  isSubmitting: boolean;
  onCancel: () => void;
}

export function NewNoteHeader({
  isSubmitting,
  onCancel,
}: NewNoteHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-[13px] text-muted-foreground w-fit"
        asChild
      >
        <Link href="/notes">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to notes
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">New note</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Capture an idea, decision, or working context.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-[13px]"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating…" : "Create note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
