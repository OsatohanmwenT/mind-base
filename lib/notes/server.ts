import "server-only";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";

import { STARTER_NOTE_TAGS } from "./constants";
import { countWords, normalizeTags } from "./normalization";
import {
  getMinSemanticQueryLength,
  getSemanticResultLimit,
  searchNotesSemantic,
} from "./semantic";
import type {
  Note,
  NoteStatus,
  NotesListResult,
  SortMode,
} from "./types";

interface NoteRecord {
  id: string;
  user_id: string;
  title: string;
  content: string;
  summary: string;
  status: NoteStatus;
  created_at: string;
  updated_at: string;
}

export interface NoteWithTagsRecord extends NoteRecord {
  tags: string[] | null;
}

interface SemanticNoteRecord extends NoteWithTagsRecord {
  similarity: number;
}

interface UsedTagRecord {
  name: string;
  usage_count: number;
}

interface ListNotesFilters {
  query: string;
  tags: string[];
  sort: SortMode;
}

export function mapNoteRecord(record: NoteWithTagsRecord): Note {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    summary: record.summary,
    tags: record.tags ?? [],
    updatedAt: record.updated_at,
    createdAt: record.created_at,
    imageCount: 0,
    wordCount: countWords(record.content),
    status: record.status,
    isPinned: false,
  };
}

async function requireInsforgeAccessToken() {
  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return null;
  }

  return accessToken;
}

export async function listNotesForCurrentUser(
  filters: ListNotesFilters
): Promise<NotesListResult> {
  const accessToken = await requireInsforgeAccessToken();

  if (!accessToken) {
    return {
      notes: [],
      totalCount: 0,
      searchMode: "browse",
    };
  }

  const insforge = createInsforgeServerClient(accessToken);
  const normalizedTags = normalizeTags(filters.tags);
  const trimmedQuery = filters.query.trim();

  async function loadLexical(
    searchMode: NotesListResult["searchMode"]
  ): Promise<NotesListResult> {
    const [notesResponse, countResponse] = await Promise.all([
      insforge.database.rpc("list_notes_with_tags", {
        p_query: filters.query,
        p_tags: normalizedTags,
        p_sort: filters.sort,
      }),
      insforge.database.rpc("count_notes"),
    ]);

    if (notesResponse.error) {
      throw new Error(notesResponse.error.message || "Unable to load notes.");
    }

    if (countResponse.error) {
      throw new Error(
        countResponse.error.message || "Unable to count notes."
      );
    }

    return {
      notes: ((notesResponse.data ?? []) as NoteWithTagsRecord[]).map(
        mapNoteRecord
      ),
      totalCount: Number(countResponse.data ?? 0),
      searchMode,
    };
  }

  if (!trimmedQuery) {
    return loadLexical("browse");
  }

  if (trimmedQuery.length < getMinSemanticQueryLength()) {
    return loadLexical("fallback");
  }

  try {
    const [semanticNotes, countResponse] = await Promise.all([
      searchNotesSemantic(accessToken, {
        query: trimmedQuery,
        tags: normalizedTags,
        limit: getSemanticResultLimit(),
      }),
      insforge.database.rpc("count_notes"),
    ]);

    if (countResponse.error) {
      throw new Error(
        countResponse.error.message || "Unable to count notes."
      );
    }

    return {
      notes: (semanticNotes as SemanticNoteRecord[]).map(mapNoteRecord),
      totalCount: Number(countResponse.data ?? 0),
      searchMode: "semantic",
    };
  } catch {
    return loadLexical("fallback");
  }
}

export async function listUsedTagsForCurrentUser(): Promise<string[]> {
  const accessToken = await requireInsforgeAccessToken();

  if (!accessToken) {
    return [];
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("list_used_tags");

  if (error) {
    throw new Error(error.message || "Unable to load tags.");
  }

  return ((data ?? []) as UsedTagRecord[]).map((tag) => tag.name);
}

export async function getNoteByIdForCurrentUser(
  noteId: string
): Promise<Note | null> {
  const accessToken = await requireInsforgeAccessToken();

  if (!accessToken) {
    return null;
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("get_note_with_tags", {
    p_note_id: noteId,
  });

  if (error) {
    throw new Error(error.message || "Unable to load note.");
  }

  const noteRecord = (data ?? [])[0] as NoteWithTagsRecord | undefined;

  return noteRecord ? mapNoteRecord(noteRecord) : null;
}

export async function listSuggestedTagsForCurrentUser(): Promise<string[]> {
  const usedTags = await listUsedTagsForCurrentUser();
  const usedTagSet = new Set(usedTags);

  return [
    ...usedTags,
    ...STARTER_NOTE_TAGS.filter((tag) => !usedTagSet.has(tag)),
  ];
}
