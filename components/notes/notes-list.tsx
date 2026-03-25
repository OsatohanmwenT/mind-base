"use client";

import type { Note, NotesSearchMode } from "@/lib/notes/types";
import { NoteListItem } from "./note-list-item";
import { EmptyLibraryState } from "./empty-library-state";

interface NotesListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isFiltered: boolean;
  searchMode: NotesSearchMode;
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  isFiltered,
  searchMode,
}: NotesListProps) {
  if (notes.length === 0) {
    return (
      <EmptyLibraryState
        isFiltered={isFiltered}
        searchMode={searchMode}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2" role="listbox" aria-label="Notes">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          isSelected={selectedId === note.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
