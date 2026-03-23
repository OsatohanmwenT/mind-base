"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";
import {
  MAX_NOTE_TAG_LENGTH,
  MAX_NOTE_TAGS,
  normalizeTag,
  normalizeTags,
} from "@/lib/notes/normalization";

export type CreateNoteActionState = {
  error: string | null;
};

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function createNoteAction(
  _previousState: CreateNoteActionState,
  formData: FormData
): Promise<CreateNoteActionState> {
  const title = readString(formData.get("title")).trim();
  const content = readString(formData.get("content"));
  const rawTags = formData
    .getAll("tags")
    .filter((value): value is string => typeof value === "string");

  if (!content.trim()) {
    return {
      error: "Write some content before creating your note.",
    };
  }

  const oversizedTag = rawTags.find(
    (tag) => normalizeTag(tag).length > MAX_NOTE_TAG_LENGTH
  );

  if (oversizedTag) {
    return {
      error: `Tags must be ${MAX_NOTE_TAG_LENGTH} characters or fewer.`,
    };
  }

  const uniqueNormalizedCount = new Set(
    rawTags.map((tag) => normalizeTag(tag)).filter(Boolean)
  ).size;

  if (uniqueNormalizedCount > MAX_NOTE_TAGS) {
    return {
      error: `Add up to ${MAX_NOTE_TAGS} tags per note.`,
    };
  }

  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    return {
      error: "Your session expired. Sign in again and try creating the note.",
    };
  }

  const insforge = createInsforgeServerClient(accessToken);
  const { error } = await insforge.database.rpc("create_note_with_tags", {
    p_title: title,
    p_content: content,
    p_tags: normalizeTags(rawTags),
  });

  if (error) {
    return {
      error: error.message || "Unable to create your note right now.",
    };
  }

  revalidatePath("/notes");
  revalidatePath("/notes/new");
  redirect("/notes");
}
