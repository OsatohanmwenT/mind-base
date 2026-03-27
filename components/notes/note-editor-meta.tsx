"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/notes/selectors";
import type { NoteEditorSaveState, NoteStatus } from "@/lib/notes/types";

interface NoteEditorMetaProps {
  status: NoteStatus;
  wordCount: number;
  readingTime: number;
  saveState: NoteEditorSaveState;
  lastSavedAt: string | null;
  summary: string;
  hasActiveUploads: boolean;
  isGeneratingAutoOrganize: boolean;
}

export function NoteEditorMeta({
  status,
  wordCount,
  readingTime,
  saveState,
  lastSavedAt,
  summary,
  hasActiveUploads,
  isGeneratingAutoOrganize,
}: NoteEditorMetaProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
        Details
      </p>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge
            variant={status === "organized" ? "secondary" : "outline"}
            className="font-mono text-[10px] capitalize"
          >
            {status === "organized" && (
              <Sparkles className="mr-1 h-2.5 w-2.5" />
            )}
            {status}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Words</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
            {wordCount}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Reading time</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
            {readingTime} min
          </span>
        </div>

        {lastSavedAt && saveState !== "dirty" && saveState !== "saving" && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last saved</span>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatRelativeTime(lastSavedAt)}
            </span>
          </div>
        )}
      </div>

      {summary && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
            Summary
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            {summary}
          </p>
        </div>
      )}

      {(saveState === "saving" ||
        saveState === "error" ||
        hasActiveUploads ||
        isGeneratingAutoOrganize) && (
        <div className="space-y-1 border-t border-border/40 pt-2.5">
          {saveState === "saving" && (
            <p className="text-[11px] font-mono text-primary/60">Saving...</p>
          )}
          {saveState === "error" && (
            <p className="text-[11px] font-mono text-destructive/70">
              Save failed
            </p>
          )}
          {hasActiveUploads && (
            <p className="text-[11px] font-mono text-primary/60">
              Uploading images...
            </p>
          )}
          {isGeneratingAutoOrganize && (
            <p className="text-[11px] font-mono text-primary/60">
              Organizing...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
