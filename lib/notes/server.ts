import "server-only";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";

import { STARTER_NOTE_TAGS } from "./constants";
import { countWords } from "./normalization";
import type { Note, NoteStatus } from "./types";

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

interface NoteWithTagsRecord extends NoteRecord {
  tags: string[] | null;
}

interface UsedTagRecord {
  name: string;
  usage_count: number;
}

function mapNoteRecord(record: NoteWithTagsRecord): Note {
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

export async function listNotesForCurrentUser(): Promise<Note[]> {
  const accessToken = await requireInsforgeAccessToken();

  if (!accessToken) {
    return [];
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("list_notes_with_tags");

  if (error) {
    throw new Error(error.message || "Unable to load notes.");
  }

  return ((data ?? []) as NoteWithTagsRecord[]).map(mapNoteRecord);
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

export async function listSuggestedTagsForCurrentUser(): Promise<string[]> {
  const usedTags = await listUsedTagsForCurrentUser();
  const usedTagSet = new Set(usedTags);

  return [
    ...usedTags,
    ...STARTER_NOTE_TAGS.filter((tag) => !usedTagSet.has(tag)),
  ];
}
