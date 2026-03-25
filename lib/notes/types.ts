import type { NotesSearchParams } from "./search-params";

export type NoteStatus = "draft" | "organized";
export type NoteEditorSaveState =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error";
export type NotesSearchMode = "browse" | "semantic" | "fallback";

export type SortMode = NotesSearchParams["sort"];

export interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  imageCount: number;
  wordCount: number;
  status: NoteStatus;
  isPinned?: boolean;
}

export interface NotesListResult {
  notes: Note[];
  totalCount: number;
  searchMode: NotesSearchMode;
}
