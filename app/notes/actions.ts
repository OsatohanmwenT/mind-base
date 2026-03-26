"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";
import {
  markNoteEmbeddingFailed,
  upsertNoteEmbedding,
} from "@/lib/notes/semantic";
import {
  mapNoteRecord,
  searchNotesForCommandMenu,
  type NoteWithTagsRecord,
} from "@/lib/notes/server";
import type { CommandPaletteResult, Note } from "@/lib/notes/types";
import {
  MAX_NOTE_TAG_LENGTH,
  MAX_NOTE_TAGS,
  normalizeTag,
  normalizeTags,
} from "@/lib/notes/normalization";

export type CreateNoteActionState = {
  error: string | null;
};

export type UpdateNoteActionInput = {
  noteId: string;
  title: string;
  content: string;
  tags: string[];
};

export type UpdateNoteActionResult = {
  error: string | null;
  note: Note | null;
};

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function validateNotePayload(input: {
  title: string;
  content: string;
  rawTags: string[];
}):
  | {
      ok: false;
      error: string;
    }
  | {
      ok: true;
      error: null;
      title: string;
      content: string;
      normalizedTags: string[];
    } {
  const title = input.title.trim();
  const content = input.content;
  const rawTags = input.rawTags;

  if (!content.trim()) {
    return {
      ok: false,
      error: "Write some content before saving your note.",
    };
  }

  const oversizedTag = rawTags.find(
    (tag) => normalizeTag(tag).length > MAX_NOTE_TAG_LENGTH
  );

  if (oversizedTag) {
    return {
      ok: false,
      error: `Tags must be ${MAX_NOTE_TAG_LENGTH} characters or fewer.`,
    };
  }

  const uniqueNormalizedCount = new Set(
    rawTags.map((tag) => normalizeTag(tag)).filter(Boolean)
  ).size;

  if (uniqueNormalizedCount > MAX_NOTE_TAGS) {
    return {
      ok: false,
      error: `Add up to ${MAX_NOTE_TAGS} tags per note.`,
    };
  }

  return {
    ok: true,
    error: null,
    title,
    content,
    normalizedTags: normalizeTags(rawTags),
  };
}

export async function createNoteAction(
  _previousState: CreateNoteActionState,
  formData: FormData
): Promise<CreateNoteActionState> {
  const rawTags = formData
    .getAll("tags")
    .filter((value): value is string => typeof value === "string");

  const validation = validateNotePayload({
    title: readString(formData.get("title")),
    content: readString(formData.get("content")),
    rawTags,
  });

  if (!validation.ok) {
    return {
      error:
        validation.error === "Write some content before saving your note."
          ? "Write some content before creating your note."
          : validation.error,
    };
  }

  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return {
      error: "Your session expired. Sign in again and try creating the note.",
    };
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("create_note_with_tags", {
    p_title: validation.title,
    p_content: validation.content,
    p_tags: validation.normalizedTags,
  });

  if (error) {
    return {
      error: error.message || "Unable to create your note right now.",
    };
  }

  const noteId = typeof data === "string" ? data : null;

  if (noteId) {
    try {
      const {
        data: authData,
        error: authError,
      } = await insforge.auth.getCurrentUser();

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Unable to resolve current user.");
      }

      await upsertNoteEmbedding(accessToken, {
        noteId,
        userId: authData.user.id,
        title: validation.title,
        summary: "",
        content: validation.content,
      });
    } catch (embeddingError) {
      try {
        const {
          data: authData,
        } = await insforge.auth.getCurrentUser();

        if (authData.user) {
          await markNoteEmbeddingFailed(
            accessToken,
            noteId,
            authData.user.id,
            embeddingError instanceof Error
              ? embeddingError.message
              : "Embedding generation failed."
          );
        }
      } catch {}
    }
  }

  revalidatePath("/notes");
  revalidatePath("/notes/new");
  redirect("/notes");
}

export async function updateNoteAction(
  input: UpdateNoteActionInput
): Promise<UpdateNoteActionResult> {
  const validation = validateNotePayload({
    title: input.title,
    content: input.content,
    rawTags: input.tags,
  });

  if (!validation.ok) {
    return {
      error: validation.error,
      note: null,
    };
  }

  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return {
      error: "Your session expired. Sign in again and try saving the note.",
      note: null,
    };
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { data, error } = await insforge.database.rpc("update_note_with_tags", {
    p_note_id: input.noteId,
    p_title: validation.title,
    p_content: validation.content,
    p_tags: validation.normalizedTags,
  });

  if (error) {
    return {
      error: error.message || "Unable to save your note right now.",
      note: null,
    };
  }

  const noteRecord = (data ?? [])[0] as NoteWithTagsRecord | undefined;

  if (!noteRecord) {
    return {
      error: "Unable to load the saved note.",
      note: null,
    };
  }

  try {
    await upsertNoteEmbedding(accessToken, {
      noteId: noteRecord.id,
      userId: noteRecord.user_id,
      title: noteRecord.title,
      summary: noteRecord.summary,
      content: noteRecord.content,
    });
  } catch (embeddingError) {
    try {
      await markNoteEmbeddingFailed(
        accessToken,
        noteRecord.id,
        noteRecord.user_id,
        embeddingError instanceof Error
          ? embeddingError.message
          : "Embedding generation failed."
      );
    } catch {}
  }

  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);

  return {
    error: null,
    note: mapNoteRecord(noteRecord),
  };
}

export async function searchNotesForCommandMenuAction(
  query: string
): Promise<CommandPaletteResult> {
  return searchNotesForCommandMenu(query);
}
