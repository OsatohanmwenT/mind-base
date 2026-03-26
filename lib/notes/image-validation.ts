const ONE_MEGABYTE = 1024 * 1024;

export const NOTE_IMAGES_BUCKET = "note-images";
export const MAX_NOTE_IMAGES = 10;
export const MAX_NOTE_IMAGE_SIZE_BYTES = 5 * ONE_MEGABYTE;
export const NOTE_IMAGE_READ_URL_TTL_SECONDS = 60 * 10;

export const NOTE_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const NOTE_IMAGE_EXTENSION_BY_MIME_TYPE: Record<
  (typeof NOTE_IMAGE_ACCEPTED_MIME_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type NoteImageAcceptedMimeType =
  (typeof NOTE_IMAGE_ACCEPTED_MIME_TYPES)[number];

function normalizeFilename(filename: string) {
  const trimmed = filename.trim();
  return trimmed || "image";
}

export function isAcceptedNoteImageMimeType(
  mimeType: string
): mimeType is NoteImageAcceptedMimeType {
  return NOTE_IMAGE_ACCEPTED_MIME_TYPES.includes(
    mimeType as NoteImageAcceptedMimeType
  );
}

export function validateNoteImageFileInput(input: {
  filename: string;
  mimeType: string;
  size: number;
}) {
  const filename = normalizeFilename(input.filename);

  if (!isAcceptedNoteImageMimeType(input.mimeType)) {
    return {
      ok: false as const,
      error: "Use a JPG, PNG, WebP, or GIF image.",
    };
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return {
      ok: false as const,
      error: "Choose an image file before uploading.",
    };
  }

  if (input.size > MAX_NOTE_IMAGE_SIZE_BYTES) {
    return {
      ok: false as const,
      error: "Images must be 5 MB or smaller.",
    };
  }

  return {
    ok: true as const,
    value: {
      filename,
      mimeType: input.mimeType,
      size: input.size,
    },
  };
}

export function getNoteImageExtension(mimeType: string) {
  if (!isAcceptedNoteImageMimeType(mimeType)) {
    throw new Error(`Unsupported note image type: ${mimeType}`);
  }

  return NOTE_IMAGE_EXTENSION_BY_MIME_TYPE[mimeType];
}

export function buildNoteImageStorageKey(input: {
  userId: string;
  noteId: string;
  imageId: string;
  mimeType: NoteImageAcceptedMimeType;
}) {
  const extension = getNoteImageExtension(input.mimeType);
  return `users/${input.userId}/notes/${input.noteId}/${input.imageId}.${extension}`;
}
