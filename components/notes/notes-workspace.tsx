"use client";

import { useState, useMemo, useCallback } from "react";

import { filterNotes, sortNotes } from "@/lib/notes/selectors";
import type { Note, SortMode } from "@/lib/notes/types";
import { Card, CardContent } from "@/components/ui/card";

import { NotesToolbar } from "./notes-toolbar";
import { NotesList } from "./notes-list";
import { NotePreview } from "./note-preview";

interface NotesWorkspaceProps {
  notes: Note[];
  allTags: string[];
}

export function NotesWorkspace({ notes, allTags }: NotesWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const visibleActiveTags = useMemo(
    () => activeTags.filter((tag) => allTags.includes(tag)),
    [activeTags, allTags]
  );

  const filteredNotes = useMemo(
    () => sortNotes(filterNotes(notes, query, visibleActiveTags), sortMode),
    [notes, query, visibleActiveTags, sortMode]
  );

  const selectedNote = useMemo(
    () =>
      filteredNotes.find((n) => n.id === selectedId) ??
      filteredNotes[0] ??
      null,
    [filteredNotes, selectedId]
  );

  const handleToggleTag = useCallback((tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const isFiltered = query.trim() !== "" || visibleActiveTags.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <NotesToolbar
        query={query}
        onQueryChange={setQuery}
        allTags={allTags}
        activeTags={visibleActiveTags}
        onToggleTag={handleToggleTag}
        sortMode={sortMode}
        onSortChange={setSortMode}
        resultCount={filteredNotes.length}
        totalCount={notes.length}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 max-h-[calc(100dvh-280px)] overflow-y-auto pr-1 scrollbar-thin">
          <NotesList
            notes={filteredNotes}
            selectedId={selectedNote?.id ?? null}
            onSelect={setSelectedId}
            isFiltered={isFiltered}
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
