"use client";

import {
  Calendar,
  Clock,
  ImageIcon,
  Sparkles,
  FileText,
  ArrowRight,
} from "lucide-react";
import { getNoteDisplayTitle } from "@/lib/notes/normalization";
import type { Note } from "@/lib/notes/types";
import { formatRelativeTime } from "@/lib/notes/selectors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NotePreviewProps {
  note: Note | null;
}

function EmptyPreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-20 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-muted/20">
        <FileText className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground/50">
        Select a note to preview
      </p>
    </div>
  );
}

export function NotePreview({ note }: NotePreviewProps) {
  if (!note) return <EmptyPreview />;

  const readingTime = Math.max(1, Math.ceil(note.wordCount / 200));

  return (
    <div className="flex flex-col gap-5">
      <div>
        {note.status === "organized" && (
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-primary/70">
            <Sparkles className="h-3 w-3" />
            <span className="font-mono uppercase tracking-wider">
              AI-organized
            </span>
          </div>
        )}
        {note.status === "draft" && (
          <div className="mb-2">
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground/60">
              draft
            </Badge>
          </div>
        )}

        <h2 className="text-lg font-semibold leading-snug tracking-tight">
          {getNoteDisplayTitle(note.title)}
        </h2>

        {note.summary && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {note.summary}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/60">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated {formatRelativeTime(note.updatedAt)}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Created {formatRelativeTime(note.createdAt)}
        </span>
        <span>{note.wordCount} words · {readingTime} min read</span>
        {note.imageCount > 0 && (
          <span className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {note.imageCount} {note.imageCount === 1 ? "image" : "images"}
          </span>
        )}
      </div>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="font-mono text-[11px]"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/50 mb-3">
          Content preview
        </p>
        <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {note.content}
        </div>
      </div>

      <div className="border-t border-border/40 pt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled
          title="Note editing coming soon"
        >
          Open note
          <ArrowRight className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground"
          disabled
          title="Auto-organize coming soon"
        >
          <Sparkles className="h-3 w-3" />
          Auto-organize
        </Button>
      </div>
    </div>
  );
}
