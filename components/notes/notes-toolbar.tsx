"use client";

import { Search, X, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortMode } from "@/lib/notes/types";

interface NotesToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  allTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  resultCount: number;
  totalCount: number;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "alpha", label: "A – Z" },
];

export function NotesToolbar({
  query,
  onQueryChange,
  allTags,
  activeTags,
  onToggleTag,
  sortMode,
  onSortChange,
  resultCount,
  totalCount,
}: NotesToolbarProps) {
  const isFiltered = query.trim() !== "" || activeTags.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search notes, systems, decisions, ideas…"
            className="h-9 pl-9 pr-9 text-sm bg-background/60"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1 rounded-md border border-border/70 bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground/50 select-none">
          <Command className="h-3 w-3" />
          <span className="font-mono">K</span>
        </div>

        <Select value={sortMode} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger size="sm" className="text-xs text-muted-foreground" aria-label="Sort notes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {allTags.map((tag) => {
            const isActive = activeTags.includes(tag);
            return (
              <Badge
                key={tag}
                variant={isActive ? "default" : "outline"}
                className={`shrink-0 cursor-pointer font-mono text-[11px] ${
                  isActive
                    ? ""
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => onToggleTag(tag)}
                role="checkbox"
                aria-checked={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleTag(tag);
                  }
                }}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>
          {isFiltered
            ? `${resultCount} of ${totalCount} notes`
            : `${totalCount} notes`}
        </span>
        {isFiltered && (
          <button
            onClick={() => {
              onQueryChange("");
              activeTags.forEach((tag) => onToggleTag(tag));
            }}
            className="hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
