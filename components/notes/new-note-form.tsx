"use client";

import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewNoteTagsInput } from "./new-note-tags-input";

interface NewNoteFormProps {
  title: string;
  content: string;
  tags: string[];
  tagInput: string;
  wordCount: number;
  suggestedTags: string[];
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  contentError?: string;
  submitError?: string | null;
}

export function NewNoteForm({
  title,
  content,
  tags,
  tagInput,
  wordCount,
  suggestedTags,
  onTitleChange,
  onContentChange,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  contentError,
  submitError,
}: NewNoteFormProps) {
  const contentErrorId = useId();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-0 pt-1">
          <input
            name="title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Untitled note"
            className="w-full text-lg font-semibold tracking-tight bg-transparent outline-none placeholder:text-muted-foreground/30"
            aria-label="Note title"
            autoFocus
          />

          <div className="border-t border-border/40 my-3" />

          <textarea
            name="content"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Start writing…"
            className="w-full min-h-[280px] text-sm leading-relaxed bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 sm:min-h-[340px]"
            aria-label="Note content"
            aria-invalid={contentError ? true : undefined}
            aria-describedby={contentError ? contentErrorId : undefined}
          />
        </CardContent>
      </Card>

      {contentError && (
        <p id={contentErrorId} className="text-xs text-destructive/80">
          {contentError}
        </p>
      )}

      {submitError && (
        <p className="text-xs text-destructive/80">{submitError}</p>
      )}

      <NewNoteTagsInput
        tags={tags}
        tagInput={tagInput}
        suggestedTags={suggestedTags}
        onTagInputChange={onTagInputChange}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
      />

      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/50">
        <Badge
          variant="outline"
          className="font-mono text-[10px] text-muted-foreground/60"
        >
          draft
        </Badge>
        <span className="font-mono">{wordCount} words</span>
      </div>
    </div>
  );
}
