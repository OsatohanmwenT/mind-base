import { NextResponse } from "next/server";

import {
  markNoteImageUploadFailedForCurrentUser,
  NoteImageError,
} from "@/lib/notes/images";
import type { FailNoteImageUploadInput } from "@/lib/notes/types";

function toErrorResponse(error: unknown) {
  if (error instanceof NoteImageError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    { error: "Unable to update this image upload right now." },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string; imageId: string }> }
) {
  try {
    const { noteId, imageId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | FailNoteImageUploadInput
      | null;
    const result = await markNoteImageUploadFailedForCurrentUser(
      noteId,
      imageId,
      body?.error
    );

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
