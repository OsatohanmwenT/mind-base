"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Sparkles } from "lucide-react";

import { searchNotesForCommandMenuAction } from "@/app/notes/actions";
import type {
  CommandPaletteItem,
  CommandPaletteSearchMode,
} from "@/lib/notes/types";
import { formatRelativeTime } from "@/lib/notes/selectors";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const DEBOUNCE_MS = 220;
const MIN_QUERY_LENGTH = 2;

export function NotesCommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandPaletteItem[]>([]);
  const [searchMode, setSearchMode] = useState<CommandPaletteSearchMode>("fallback");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetState = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearchMode("fallback");
    setIsSearching(false);
    setError(null);
    setHasSearched(false);
    requestIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetState();
    }
  }

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsSearching(true);

    try {
      const result = await searchNotesForCommandMenuAction(trimmed);

      if (currentRequestId !== requestIdRef.current) return;

      setResults(result.items);
      setSearchMode(result.searchMode);
      setError(result.error);
      setHasSearched(true);
    } catch {
      if (currentRequestId !== requestIdRef.current) return;
      setError("Search failed.");
      setHasSearched(true);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = nextQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      setIsSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void executeSearch(nextQuery);
    }, DEBOUNCE_MS);
  }

  function handleSelectNote(noteId: string) {
    setOpen(false);
    resetState();
    router.push(`/notes/${noteId}`);
  }

  function handleNewNote() {
    setOpen(false);
    resetState();
    router.push("/notes/new");
  }

  const trimmedQuery = query.trim();
  const showMinLengthHint = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH;
  const showIdle = trimmedQuery.length === 0;
  const showResults = hasSearched && results.length > 0;
  const showEmpty = hasSearched && results.length === 0 && !error;
  const showError = hasSearched && !!error && results.length === 0;

  const groupHeading = useMemo(() => {
    if (!showResults) return "";
    const modeLabel = searchMode === "semantic" ? "Semantic matches" : "Keyword matches";
    return `${modeLabel} · ${results.length} result${results.length !== 1 ? "s" : ""}`;
  }, [showResults, searchMode, results.length]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search Notes"
      description="Find notes by meaning or keyword"
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          placeholder="Search notes by meaning…"
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList>
          {showIdle && (
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={handleNewNote}>
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>New note</span>
              </CommandItem>
            </CommandGroup>
          )}

          {showIdle && (
            <div className="px-3 pb-3 pt-1">
              <p className="text-[11px] text-muted-foreground/50">
                Type to search by meaning with semantic search, or use keywords
                for short queries. Press{" "}
                <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                to close.
              </p>
            </div>
          )}

          {showMinLengthHint && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground/60">
                Type at least {MIN_QUERY_LENGTH} characters to search
              </p>
            </div>
          )}

          {isSearching && !showResults && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground/60">Searching…</p>
            </div>
          )}

          {showResults && (
            <>
              <CommandGroup heading={groupHeading}>
                {results.map((item) => (
                  <PaletteNoteItem
                    key={item.id}
                    item={item}
                    onSelect={handleSelectNote}
                  />
                ))}
              </CommandGroup>
              {searchMode === "fallback" && trimmedQuery.length >= 3 && (
                <div className="px-3 pb-2 pt-1">
                  <p className="text-[10px] text-muted-foreground/40">
                    Showing keyword results — semantic search was unavailable
                  </p>
                </div>
              )}
            </>
          )}

          {showEmpty && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-2">
                <Search className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">
                  No notes found for &ldquo;{trimmedQuery}&rdquo;
                </p>
                <p className="text-[11px] text-muted-foreground/40">
                  Try a different search term or phrase
                </p>
              </div>
            </CommandEmpty>
          )}

          {showError && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground/60">{error}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/40">
                Try again or close the palette
              </p>
            </div>
          )}
        </CommandList>

        {isSearching && showResults && (
          <div className="border-t border-border/40 px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground/40">Updating…</p>
          </div>
        )}
      </Command>
    </CommandDialog>
  );
}

function PaletteNoteItem({
  item,
  onSelect,
}: {
  item: CommandPaletteItem;
  onSelect: (id: string) => void;
}) {
  return (
    <CommandItem
      value={item.id}
      onSelect={() => onSelect(item.id)}
      className="flex flex-col items-start gap-1 px-3 py-2.5"
    >
      <div className="flex w-full items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span className="flex-1 truncate text-sm font-medium leading-snug">
          {item.title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.status === "organized" && (
            <Sparkles className="h-3 w-3 text-primary/50" />
          )}
          {item.status === "draft" && (
            <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground/50 px-1 py-0">
              draft
            </Badge>
          )}
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {formatRelativeTime(item.updatedAt)}
          </span>
        </div>
      </div>
      {item.snippet && (
        <p className="pl-5.5 text-xs leading-relaxed text-muted-foreground/60 line-clamp-1">
          {item.snippet}
        </p>
      )}
      {item.tags.length > 0 && (
        <div className="pl-5.5 flex items-center gap-1">
          {item.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="font-mono text-[9px] text-muted-foreground/50 px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </CommandItem>
  );
}
