"use client";

import { Sparkles } from "lucide-react";

import type {
  AutoOrganizeModelOption,
  AutoOrganizeSuggestion,
} from "@/lib/notes/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NoteAutoOrganizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: AutoOrganizeModelOption[];
  selectedModelId: string | null;
  onSelectedModelIdChange: (modelId: string) => void;
  suggestion: AutoOrganizeSuggestion | null;
  error: string | null;
  isGenerating: boolean;
  isApplying: boolean;
  minWordCount: number;
  wordCount: number;
  featureError: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
  onApply: () => void;
}

function ModelOptionLabel({ model }: { model: AutoOrganizeModelOption }) {
  return (
    <div className="flex min-w-0 flex-col text-left">
      <span className="truncate text-sm font-medium leading-tight">
        {model.label}
      </span>
      <span className="truncate pt-1 text-[11px] leading-tight text-muted-foreground">
        {model.provider} · {model.qualityTier} · {model.speedTier} ·{" "}
        {model.costTier}
      </span>
    </div>
  );
}

export function NoteAutoOrganizeDialog({
  open,
  onOpenChange,
  models,
  selectedModelId,
  onSelectedModelIdChange,
  suggestion,
  error,
  isGenerating,
  isApplying,
  minWordCount,
  wordCount,
  featureError,
  canGenerate,
  onGenerate,
  onApply,
}: NoteAutoOrganizeDialogProps) {
  const activeModel =
    models.find((model) => model.id === selectedModelId) ?? models[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary/70" />
            Auto-organize
          </DialogTitle>
          <DialogDescription>
            Generate a better title, a short summary, and a few AI tags without
            changing the note content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              AI model
            </label>
            <Select
              value={selectedModelId ?? undefined}
              onValueChange={onSelectedModelIdChange}
              disabled={models.length === 0 || isGenerating || isApplying}
            >
              <SelectTrigger className="w-full justify-between">
                <SelectValue placeholder="Choose a model">
                  {activeModel ? activeModel.label : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" className="w-full">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <ModelOptionLabel model={model} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {featureError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive/80">
              {featureError}
            </div>
          ) : wordCount < minWordCount ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Write at least {minWordCount} words before using auto-organize.
              This note currently has {wordCount} word{wordCount === 1 ? "" : "s"}.
            </div>
          ) : null}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive/80">
              {error}
            </div>
          )}

          {suggestion ? (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3">
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
                  Suggested title
                </p>
                <p className="text-sm font-medium">{suggestion.title}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
                  Suggested summary
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {suggestion.summary}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
                  Suggested tags
                </p>
                {suggestion.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="font-mono text-[11px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No AI tags suggested.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
              {isGenerating
                ? "Analyzing note…"
                : "Choose a model and generate suggestions."}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating || isApplying}
          >
            {isGenerating ? "Analyzing..." : suggestion ? "Run again" : "Generate"}
          </Button>
          <Button
            type="button"
            onClick={onApply}
            disabled={!suggestion || isGenerating || isApplying}
          >
            {isApplying ? "Applying..." : "Apply suggestions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
