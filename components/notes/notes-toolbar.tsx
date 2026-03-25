"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultNotesSortMode, notesSortModes } from "@/lib/notes/search-params";
import type { NotesSearchMode, SortMode } from "@/lib/notes/types";

interface NotesToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  allTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onClearFilters: () => void;
  resultCount: number;
  totalCount: number;
  isPending: boolean;
  searchMode: NotesSearchMode;
}

const SORT_OPTION_LABELS: Record<SortMode, string> = {
  updated: "Recently updated",
  created: "Recently created",
  alpha: "A – Z",
};

export function NotesToolbar({
  query,
  onQueryChange,
  allTags,
  activeTags,
  onToggleTag,
  sortMode,
  onSortChange,
  onClearFilters,
  resultCount,
  totalCount,
  isPending,
  searchMode,
}: NotesToolbarProps) {
  const isFiltered = query.trim() !== "" || activeTags.length > 0;
  const hasCustomState = isFiltered || sortMode !== defaultNotesSortMode;
  const isSemanticMode = searchMode === "semantic";
  const isFallbackMode = searchMode === "fallback" && query.trim() !== "";

  return (
    <div className="space-y-3" aria-busy={isPending}>
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

        <Select
          value={sortMode}
          disabled={isSemanticMode}
          onValueChange={(value) => {
            if (
              value === notesSortModes[0] ||
              value === notesSortModes[1] ||
              value === notesSortModes[2]
            ) {
              onSortChange(value);
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="text-xs text-muted-foreground"
            aria-label="Sort notes"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {notesSortModes.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {SORT_OPTION_LABELS[mode]}
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
        <div className="flex items-center gap-2">
          <span>
            {isSemanticMode
              ? `${resultCount} semantic matches from ${totalCount} notes`
              : isFiltered
                ? `${resultCount} of ${totalCount} notes`
                : `${totalCount} notes`}
          </span>
          {isSemanticMode && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              relevance
            </Badge>
          )}
          {isFallbackMode && (
            <Badge variant="outline" className="font-mono text-[10px]">
              keyword fallback
            </Badge>
          )}
        </div>
        {hasCustomState && (
          <button
            onClick={onClearFilters}
            className="hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
