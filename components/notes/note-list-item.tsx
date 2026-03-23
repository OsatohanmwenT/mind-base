"use client";

import { ImageIcon, Pin, Sparkles } from "lucide-react";
import { getNoteDisplayTitle } from "@/lib/notes/normalization";
import type { Note } from "@/lib/notes/types";
import { formatRelativeTime } from "@/lib/notes/selectors";
import { Badge } from "@/components/ui/badge";

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function NoteListItem({ note, isSelected, onSelect }: NoteListItemProps) {
  return (
    <button
      onClick={() => onSelect(note.id)}
      className={`group w-full text-left rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        isSelected
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-border/60 bg-background/40 hover:border-foreground/15 hover:bg-background/70"
      }`}
      aria-current={isSelected ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug line-clamp-1">
          {getNoteDisplayTitle(note.title)}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {note.isPinned && (
            <Pin className="h-3 w-3 text-muted-foreground/50 fill-muted-foreground/30" />
          )}
          {note.status === "organized" && (
            <Sparkles className="h-3 w-3 text-primary/50" />
          )}
        </div>
      </div>

      {note.summary ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {note.summary}
        </p>
      ) : (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/50 line-clamp-2 italic">
          {note.content.slice(0, 120)}…
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground/50">
        <span className="font-mono">{formatRelativeTime(note.updatedAt)}</span>
        {note.imageCount > 0 && (
          <span className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {note.imageCount}
          </span>
        )}
        <span>{note.wordCount} words</span>
        {note.status === "draft" && (
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground/60">
            draft
          </Badge>
        )}
      </div>

      {note.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {note.tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="font-mono text-[10px] text-muted-foreground/60"
            >
              {tag}
            </Badge>
          ))}
          {note.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground/40">
              +{note.tags.length - 4}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
