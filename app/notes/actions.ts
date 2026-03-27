"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";
import {
  generateAutoOrganizeSuggestion,
  hashAutoOrganizeSource,
  savePreferredAutoOrganizeModel,
} from "@/lib/notes/auto-organize";
import {
  markNoteEmbeddingFailed,
  upsertNoteEmbedding,
} from "@/lib/notes/semantic";
import {
  getNoteByIdForCurrentUser,
  mapNoteRecord,
  searchNotesForCommandMenu,
  type NoteWithTagsRecord,
} from "@/lib/notes/server";
import type {
  AutoOrganizeApplyInput,
  AutoOrganizeApplyResult,
  AutoOrganizeGenerateResult,
  CommandPaletteResult,
  Note,
} from "@/lib/notes/types";
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

export type GenerateAutoOrganizeActionInput = {
  noteId: string;
  modelId: string;
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

async function getCurrentUserOrError(accessToken: string) {
  const insforge = createInsforgeServerClient(accessToken);
  const {
    data: authData,
    error: authError,
  } = await insforge.auth.getCurrentUser();

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Unable to resolve current user.");
  }

  return {
    insforge,
    user: authData.user,
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

export async function generateAutoOrganizeSuggestionAction(
  input: GenerateAutoOrganizeActionInput
): Promise<AutoOrganizeGenerateResult> {
  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return {
      error: "Your session expired. Sign in again and try auto-organizing.",
      suggestion: null,
    };
  }

  const note = await getNoteByIdForCurrentUser(input.noteId);

  if (!note) {
    return {
      error: "Unable to load that note.",
      suggestion: null,
    };
  }

  if (!input.modelId.trim()) {
    return {
      error: "Choose an AI model before running auto-organize.",
      suggestion: null,
    };
  }

  try {
    const { user } = await getCurrentUserOrError(accessToken);
    const suggestion = await generateAutoOrganizeSuggestion(accessToken, {
      noteId: note.id,
      requestedModelId: input.modelId.trim(),
      title: note.title,
      content: note.content,
      userTags: note.userTags ?? [],
    });

    await savePreferredAutoOrganizeModel(accessToken, user.id, suggestion.modelId);

    return {
      error: null,
      suggestion,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to auto-organize this note right now.",
      suggestion: null,
    };
  }
}

export async function applyAutoOrganizeAction(
  input: AutoOrganizeApplyInput
): Promise<AutoOrganizeApplyResult> {
  const title = input.title.trim();
  const summary = input.summary.trim();
  const normalizedTags = normalizeTags(input.tags).slice(0, 3);

  if (!title) {
    return {
      error: "The generated title was empty. Run auto-organize again.",
      note: null,
    };
  }

  if (!summary) {
    return {
      error: "The generated summary was empty. Run auto-organize again.",
      note: null,
    };
  }

  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return {
      error: "Your session expired. Sign in again and try auto-organizing.",
      note: null,
    };
  }

  const note = await getNoteByIdForCurrentUser(input.noteId);

  if (!note) {
    return {
      error: "Unable to load that note.",
      note: null,
    };
  }

  const nextUniqueAiTagCount = normalizedTags.filter(
    (tag) => !(note.userTags ?? []).includes(tag)
  ).length;

  if ((note.userTags ?? []).length + nextUniqueAiTagCount > MAX_NOTE_TAGS) {
    return {
      error:
        "There is not enough room to add the AI tags without removing manual tags first.",
      note: null,
    };
  }

  const expectedHash = hashAutoOrganizeSource({
    title: note.title,
    content: note.content,
    userTags: note.userTags ?? [],
  });

  if (input.sourceHash !== expectedHash) {
    return {
      error: "This note changed after the suggestions were generated. Run auto-organize again.",
      note: null,
    };
  }

  try {
    const { insforge } = await getCurrentUserOrError(accessToken);
    const { data, error } = await insforge.database.rpc(
      "apply_note_auto_organization",
      {
        p_note_id: input.noteId,
        p_title: title,
        p_summary: summary,
        p_ai_tags: normalizedTags,
      }
    );

    if (error) {
      return {
        error: error.message || "Unable to apply the auto-organize suggestions.",
        note: null,
      };
    }

    const noteRecord = (data ?? [])[0] as NoteWithTagsRecord | undefined;

    if (!noteRecord) {
      return {
        error: "Unable to load the updated note.",
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
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to apply the auto-organize suggestions.",
      note: null,
    };
  }
}
