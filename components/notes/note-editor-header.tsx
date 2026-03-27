"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/notes/selectors";
import type { NoteEditorSaveState } from "@/lib/notes/types";

interface NoteEditorHeaderProps {
  saveState: NoteEditorSaveState;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: string | null;
  canSave: boolean;
  canAutoOrganize: boolean;
  autoOrganizeDisabledReason?: string | null;
  onBack: () => void;
  onSave: () => void;
  onAutoOrganize: () => void;
}

function getSaveStatusLabel({
  saveState,
  saveError,
  lastSavedAt,
}: {
  saveState: NoteEditorSaveState;
  saveError: string | null;
  lastSavedAt: string | null;
}) {
  switch (saveState) {
    case "dirty":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "saved":
      return lastSavedAt
        ? `Saved ${formatRelativeTime(lastSavedAt)}`
        : "Saved";
    case "error":
      return saveError ?? "Save failed";
    default:
      return null;
  }
}

export function NoteEditorHeader({
  saveState,
  isDirty,
  saveError,
  lastSavedAt,
  canSave,
  canAutoOrganize,
  autoOrganizeDisabledReason,
  onBack,
  onSave,
  onAutoOrganize,
}: NoteEditorHeaderProps) {
  const saveStatusLabel = getSaveStatusLabel({
    saveState,
    saveError,
    lastSavedAt,
  });

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-[13px] text-muted-foreground shrink-0"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Back to notes</span>
        <span className="sm:hidden">Back</span>
      </Button>

      <div className="flex items-center gap-2 shrink-0">
        {saveStatusLabel && (
          <span
            className={`hidden sm:inline text-[11px] font-mono mr-1 ${
              saveState === "error"
                ? "text-destructive/80"
                : "text-muted-foreground/50"
            }`}
            aria-live="polite"
          >
            {saveStatusLabel}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[13px] gap-1.5 text-muted-foreground"
          disabled={!canAutoOrganize}
          title={autoOrganizeDisabledReason ?? undefined}
          onClick={onAutoOrganize}
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">Auto-organize</span>
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8 text-[13px]"
          disabled={!canSave}
          onClick={onSave}
        >
          {saveState === "saving"
            ? "Saving..."
            : saveState === "error" && isDirty
              ? "Retry"
              : "Save"}
        </Button>
      </div>
    </div>
  );
}
