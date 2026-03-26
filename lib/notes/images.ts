import "server-only";

import { revalidatePath } from "next/cache";

import { readAuthCookies } from "@/lib/auth/cookies";
import { createInsforgeServerClient } from "@/lib/insforge/server";

import {
  buildNoteImageStorageKey,
  NOTE_IMAGES_BUCKET,
  NOTE_IMAGE_READ_URL_TTL_SECONDS,
  validateNoteImageFileInput,
} from "./image-validation";
import type {
  NoteImage,
  RequestNoteImageUploadInput,
  RequestNoteImageUploadResult,
  RefreshNoteImageReadUrlResult,
} from "./types";

interface NoteImageRecord {
  id: string;
  note_id: string;
  user_id: string;
  bucket: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  status: NoteImage["status"];
  uploaded_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface StorageUploadStrategyResponse {
  method: string;
  uploadUrl?: string;
  fields?: Record<string, string>;
  confirmUrl?: string;
  confirmRequired?: boolean;
  key?: string;
  expiresAt?: string;
}

interface StorageDownloadStrategyResponse {
  method: string;
  url?: string;
  expiresAt?: string;
}

type NoteImageReadAccess = {
  readUrl: string | null;
  readUrlExpiresAt: string | null;
};

export class NoteImageError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "NoteImageError";
    this.statusCode = statusCode;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function isMissingRecordError(message: string) {
  return /not found/i.test(message);
}

function toNoteImage(record: NoteImageRecord, readAccess?: NoteImageReadAccess): NoteImage {
  return {
    id: record.id,
    noteId: record.note_id,
    bucket: record.bucket,
    storageKey: record.storage_key,
    originalFilename: record.original_filename,
    mimeType: record.mime_type,
    sizeBytes: Number(record.size_bytes),
    sortOrder: record.sort_order,
    status: record.status,
    uploadedAt: record.uploaded_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastError: record.last_error,
    readUrl: readAccess?.readUrl ?? null,
    readUrlExpiresAt: readAccess?.readUrlExpiresAt ?? null,
  };
}

async function requireAuthenticatedClient() {
  const { accessToken } = await readAuthCookies();

  if (!accessToken) {
    throw new NoteImageError(
      "Your session expired. Sign in again and try uploading an image.",
      401
    );
  }

  const insforge = createInsforgeServerClient(accessToken);
  const {
    data: authData,
    error: authError,
  } = await insforge.auth.getCurrentUser();

  if (authError || !authData.user) {
    throw new NoteImageError(
      "Your session expired. Sign in again and try uploading an image.",
      401
    );
  }

  return {
    accessToken,
    insforge,
    userId: authData.user.id,
  };
}

async function assertNoteOwnership(
  noteId: string,
  insforge: ReturnType<typeof createInsforgeServerClient>
) {
  const { data, error } = await insforge.database
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw new NoteImageError(
      error.message || "Unable to verify your note right now."
    );
  }

  if (!data) {
    throw new NoteImageError("Note not found.", 404);
  }
}

async function getNoteImageRecord(
  noteId: string,
  imageId: string,
  insforge: ReturnType<typeof createInsforgeServerClient>
) {
  const { data, error } = await insforge.database
    .from("note_images")
    .select(
      "id, note_id, user_id, bucket, storage_key, original_filename, mime_type, size_bytes, sort_order, status, uploaded_at, last_error, created_at, updated_at"
    )
    .eq("note_id", noteId)
    .eq("id", imageId)
    .maybeSingle();

  if (error) {
    throw new NoteImageError(
      error.message || "Unable to load that note image right now."
    );
  }

  if (!data) {
    throw new NoteImageError("Image not found.", 404);
  }

  return data as NoteImageRecord;
}

async function getReadAccessForRecord(
  record: NoteImageRecord,
  insforge: ReturnType<typeof createInsforgeServerClient>
): Promise<NoteImageReadAccess> {
  if (record.status !== "uploaded") {
    return {
      readUrl: null,
      readUrlExpiresAt: null,
    };
  }

  const strategy = await insforge.getHttpClient().post<StorageDownloadStrategyResponse>(
    `/api/storage/buckets/${encodeURIComponent(
      record.bucket
    )}/objects/${encodeURIComponent(record.storage_key)}/download-strategy`,
    {
      expiresIn: NOTE_IMAGE_READ_URL_TTL_SECONDS,
    }
  );

  if (!strategy.url) {
    throw new NoteImageError("Unable to create an image download URL right now.");
  }

  return {
    readUrl: strategy.url,
    readUrlExpiresAt: strategy.expiresAt ?? null,
  };
}

async function listNoteImageRecords(
  noteId: string,
  insforge: ReturnType<typeof createInsforgeServerClient>
) {
  const { data, error } = await insforge.database.rpc("list_note_images", {
    p_note_id: noteId,
  });

  if (error) {
    throw new NoteImageError(
      error.message || "Unable to load your note images right now."
    );
  }

  return (data ?? []) as NoteImageRecord[];
}

async function safeMarkNoteImageFailed(
  noteId: string,
  imageId: string,
  message: string,
  insforge: ReturnType<typeof createInsforgeServerClient>
) {
  try {
    await insforge.database.rpc("mark_note_image_upload_failed", {
      p_note_id: noteId,
      p_image_id: imageId,
      p_last_error: message,
    });
  } catch {}
}

function revalidateNotePaths(noteId: string) {
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
}

export async function listNoteImagesForCurrentUser(
  noteId: string,
  options?: { includeReadUrls?: boolean }
) {
  const { insforge } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  const records = await listNoteImageRecords(noteId, insforge);

  if (!options?.includeReadUrls) {
    return records.map((record) => toNoteImage(record));
  }

  const images = await Promise.all(
    records.map(async (record) => {
      try {
        const readAccess = await getReadAccessForRecord(record, insforge);
        return toNoteImage(record, readAccess);
      } catch {
        return toNoteImage(record);
      }
    })
  );

  return images;
}

export async function requestNoteImageUploadForCurrentUser(
  noteId: string,
  input: RequestNoteImageUploadInput
): Promise<RequestNoteImageUploadResult> {
  const validation = validateNoteImageFileInput(input);

  if (!validation.ok) {
    throw new NoteImageError(validation.error, 400);
  }

  const { insforge, userId } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  const imageId = crypto.randomUUID();
  const storageKey = buildNoteImageStorageKey({
    userId,
    noteId,
    imageId,
    mimeType: validation.value.mimeType,
  });

  const { data, error } = await insforge.database.rpc("reserve_note_image_upload", {
    p_image_id: imageId,
    p_note_id: noteId,
    p_bucket: NOTE_IMAGES_BUCKET,
    p_storage_key: storageKey,
    p_original_filename: validation.value.filename,
    p_mime_type: validation.value.mimeType,
    p_size_bytes: validation.value.size,
  });

  if (error) {
    const statusCode = isMissingRecordError(error.message) ? 404 : 400;
    throw new NoteImageError(
      error.message || "Unable to start this image upload right now.",
      statusCode
    );
  }

  const record = (data ?? [])[0] as NoteImageRecord | undefined;

  if (!record) {
    throw new NoteImageError("Unable to reserve this image upload right now.");
  }

  try {
    const strategy = await insforge.getHttpClient().post<StorageUploadStrategyResponse>(
      `/api/storage/buckets/${encodeURIComponent(
        NOTE_IMAGES_BUCKET
      )}/upload-strategy`,
      {
        filename: storageKey,
        contentType: validation.value.mimeType,
        size: validation.value.size,
      }
    );

    if (strategy.method !== "presigned" || !strategy.uploadUrl) {
      throw new NoteImageError(
        "The storage backend did not return a pre-signed upload URL."
      );
    }

    if (strategy.key && strategy.key !== storageKey) {
      throw new NoteImageError(
        "The storage backend changed the upload key unexpectedly."
      );
    }

    return {
      image: toNoteImage(record),
      upload: {
        uploadUrl: strategy.uploadUrl,
        fields: strategy.fields ?? {},
        confirmUrl: strategy.confirmUrl ?? null,
        expiresAt: strategy.expiresAt ?? null,
      },
    };
  } catch (error) {
    await safeMarkNoteImageFailed(noteId, imageId, getErrorMessage(error), insforge);

    if (error instanceof NoteImageError) {
      throw error;
    }

    throw new NoteImageError("Unable to create an image upload URL right now.");
  }
}

export async function completeNoteImageUploadForCurrentUser(
  noteId: string,
  imageId: string,
  options?: { confirmUrl?: string | null }
) {
  const { insforge } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  if (options?.confirmUrl) {
    const reservedRecord = await getNoteImageRecord(noteId, imageId, insforge);

    try {
      await insforge.getHttpClient().post(options.confirmUrl, {
        size: Number(reservedRecord.size_bytes),
        contentType: reservedRecord.mime_type,
      });
    } catch (error) {
      await safeMarkNoteImageFailed(noteId, imageId, getErrorMessage(error), insforge);

      if (error instanceof NoteImageError) {
        throw error;
      }

      throw new NoteImageError(
        "The storage backend could not confirm this upload."
      );
    }
  }

  const { data, error } = await insforge.database.rpc("complete_note_image_upload", {
    p_note_id: noteId,
    p_image_id: imageId,
  });

  if (error) {
    const statusCode = isMissingRecordError(error.message) ? 404 : 400;
    throw new NoteImageError(
      error.message || "Unable to finalize this image upload right now.",
      statusCode
    );
  }

  const record = (data ?? [])[0] as NoteImageRecord | undefined;

  if (!record) {
    throw new NoteImageError("Unable to finalize this image upload right now.");
  }

  let readAccess: NoteImageReadAccess | undefined;

  try {
    readAccess = await getReadAccessForRecord(record, insforge);
  } catch {}

  revalidateNotePaths(noteId);

  return {
    image: toNoteImage(record, readAccess),
  };
}

export async function markNoteImageUploadFailedForCurrentUser(
  noteId: string,
  imageId: string,
  message?: string
) {
  const { insforge } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  const { data, error } = await insforge.database.rpc("mark_note_image_upload_failed", {
    p_note_id: noteId,
    p_image_id: imageId,
    p_last_error: message ?? null,
  });

  if (error) {
    const statusCode = isMissingRecordError(error.message) ? 404 : 400;
    throw new NoteImageError(
      error.message || "Unable to mark this image upload as failed.",
      statusCode
    );
  }

  const record = (data ?? [])[0] as NoteImageRecord | undefined;

  if (!record) {
    throw new NoteImageError("Unable to update this image upload right now.");
  }

  revalidateNotePaths(noteId);

  return {
    image: toNoteImage(record),
  };
}

export async function refreshNoteImageReadUrlForCurrentUser(
  noteId: string,
  imageId: string
): Promise<RefreshNoteImageReadUrlResult> {
  const { insforge } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  const record = await getNoteImageRecord(noteId, imageId, insforge);

  if (record.status !== "uploaded") {
    throw new NoteImageError(
      "This image is not ready to display yet.",
      409
    );
  }

  const readAccess = await getReadAccessForRecord(record, insforge);

  if (!readAccess.readUrl) {
    throw new NoteImageError("Unable to create an image download URL right now.");
  }

  return {
    readUrl: readAccess.readUrl,
    expiresAt: readAccess.readUrlExpiresAt,
  };
}

export async function deleteNoteImageForCurrentUser(
  noteId: string,
  imageId: string
) {
  const { insforge } = await requireAuthenticatedClient();
  await assertNoteOwnership(noteId, insforge);

  const record = await getNoteImageRecord(noteId, imageId, insforge);
  const { error: storageError } = await insforge.storage
    .from(record.bucket)
    .remove(record.storage_key);

  if (
    storageError &&
    typeof storageError.statusCode === "number" &&
    storageError.statusCode !== 404
  ) {
    throw new NoteImageError(
      storageError.message || "Unable to remove this image from storage right now."
    );
  }

  const { error } = await insforge.database.rpc("delete_note_image", {
    p_note_id: noteId,
    p_image_id: imageId,
  });

  if (error) {
    await safeMarkNoteImageFailed(
      noteId,
      imageId,
      "The storage object was removed before metadata cleanup finished.",
      insforge
    );

    throw new NoteImageError(
      error.message || "Unable to remove this image right now."
    );
  }

  revalidateNotePaths(noteId);

  return {
    imageId,
  };
}
