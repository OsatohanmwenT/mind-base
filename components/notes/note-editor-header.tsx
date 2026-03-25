"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/notes/selectors";
import type { NoteEditorSaveState, NoteStatus } from "@/lib/notes/types";

interface NoteEditorHeaderProps {
  status: NoteStatus;
  saveState: NoteEditorSaveState;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: string | null;
  canSave: boolean;
  onBack: () => void;
  onSave: () => void;
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
  status,
  saveState,
  isDirty,
  saveError,
  lastSavedAt,
  canSave,
  onBack,
  onSave,
}: NoteEditorHeaderProps) {
  const saveStatusLabel = getSaveStatusLabel({
    saveState,
    saveError,
    lastSavedAt,
  });

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-[13px] text-muted-foreground w-fit"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to notes
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Edit note</h1>
          {status === "organized" && (
            <Badge
              variant="secondary"
              className="gap-1 font-mono text-[10px] text-primary/70 shrink-0"
            >
              <Sparkles className="h-2.5 w-2.5" />
              organized
            </Badge>
          )}
          {status === "draft" && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-muted-foreground/60 shrink-0"
            >
              draft
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveStatusLabel && (
            <span
              className={`text-[11px] font-mono mr-1 ${
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
            disabled
            title="Auto-organize coming soon"
          >
            <Sparkles className="h-3 w-3" />
            Auto-organize
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
                ? "Retry save"
                : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
