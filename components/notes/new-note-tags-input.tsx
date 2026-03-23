"use client";

import { useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import {
  MAX_NOTE_TAGS,
  normalizeTag,
} from "@/lib/notes/normalization";
import { Badge } from "@/components/ui/badge";

interface NewNoteTagsInputProps {
  tags: string[];
  tagInput: string;
  suggestedTags: string[];
  onTagInputChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function NewNoteTagsInput({
  tags,
  tagInput,
  suggestedTags,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: NewNoteTagsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commitTag(raw: string) {
    const normalized = normalizeTag(raw);
    if (normalized && tags.length < MAX_NOTE_TAGS) {
      onAddTag(normalized);
    }
    onTagInputChange("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      onRemoveTag(tags[tags.length - 1]);
    }
  }

  const availableSuggestions = suggestedTags.filter((t) => !tags.includes(t));

  return (
    <div className="space-y-2 flex flex-col">
      <label className="text-xs font-medium text-muted-foreground">
        Tags
        <span className="ml-1.5 font-normal text-muted-foreground/50">
          optional
        </span>
      </label>

      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 font-mono text-[11px]"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(tag);
              }}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-foreground/10"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (tagInput.trim()) commitTag(tagInput);
          }}
          placeholder={
            tags.length >= MAX_NOTE_TAGS
              ? `Up to ${MAX_NOTE_TAGS} tags`
              : tags.length === 0
                ? "Add tags…"
                : ""
          }
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/30"
          aria-label="Add a tag"
          disabled={tags.length >= MAX_NOTE_TAGS}
        />
      </div>

      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/40 mr-0.5 select-none">
            Suggestions:
          </span>
          {availableSuggestions.slice(0, 8).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="cursor-pointer font-mono text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAddTag(tag)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onAddTag(tag);
                }
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
