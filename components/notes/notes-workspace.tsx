"use client";

import { useMemo, useState, useTransition } from "react";
import { debounce, useQueryStates } from "nuqs";

import {
  defaultNotesSortMode,
  notesSearchParams,
} from "@/lib/notes/search-params";
import type { Note, NotesSearchMode, SortMode } from "@/lib/notes/types";
import { Card, CardContent } from "@/components/ui/card";

import { NotesToolbar } from "./notes-toolbar";
import { NotesList } from "./notes-list";
import { NotePreview } from "./note-preview";

interface NotesWorkspaceProps {
  notes: Note[];
  allTags: string[];
  totalCount: number;
  searchMode: NotesSearchMode;
}

const SEARCH_DEBOUNCE_MS = 300;

export function NotesWorkspace({
  notes,
  allTags,
  totalCount,
  searchMode,
}: NotesWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [{ query, tag, sort }, setNotesParams] = useQueryStates(
    notesSearchParams,
    { startTransition }
  );
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);

  const visibleTags = useMemo(
    () => [...tag, ...allTags.filter((tagName) => !tag.includes(tagName))],
    [allTags, tag]
  );

  const selectedNote = useMemo(
    () => {
      if (notes.length === 0) {
        return null;
      }

      if (selectedId === null) {
        return notes[0];
      }

      return notes.find((note) => note.id === selectedId) ?? notes[0];
    },
    [notes, selectedId]
  );

  function handleQueryChange(nextQuery: string) {
    void setNotesParams(
      {
        query: nextQuery === "" ? null : nextQuery,
      },
      nextQuery === ""
        ? undefined
        : { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) }
    );
  }

  function handleToggleTag(nextTag: string) {
    const nextTags = tag.includes(nextTag)
      ? tag.filter((value) => value !== nextTag)
      : [...tag, nextTag];

    void setNotesParams({
      tag: nextTags.length > 0 ? nextTags : null,
    });
  }

  function handleSortChange(nextSort: SortMode) {
    void setNotesParams({
      sort: nextSort === defaultNotesSortMode ? null : nextSort,
    });
  }

  function handleClearFilters() {
    void setNotesParams({
      query: null,
      tag: null,
      sort: null,
    });
  }

  const isFiltered = query.trim() !== "" || tag.length > 0;

  return (
    <div className="flex flex-col gap-6" aria-busy={isPending}>
      <NotesToolbar
        query={query}
        onQueryChange={handleQueryChange}
        allTags={visibleTags}
        activeTags={tag}
        onToggleTag={handleToggleTag}
        sortMode={sort}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
        resultCount={notes.length}
        totalCount={totalCount}
        isPending={isPending}
        searchMode={searchMode}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 max-h-[calc(100dvh-280px)] overflow-y-auto pr-1 scrollbar-thin">
          <NotesList
            notes={notes}
            selectedId={selectedNote?.id ?? null}
            onSelect={setSelectedId}
            isFiltered={isFiltered}
            searchMode={searchMode}
          />
        </div>

        <Card className="hidden lg:flex max-h-[calc(100dvh-280px)] overflow-y-auto scrollbar-thin">
          <CardContent className="pt-2">
            <NotePreview note={selectedNote} />
          </CardContent>
        </Card>

        {selectedNote && (
          <Card className="lg:hidden">
            <CardContent>
              <NotePreview note={selectedNote} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
