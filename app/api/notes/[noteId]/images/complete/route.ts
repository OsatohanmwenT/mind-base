import { NextResponse } from "next/server";

import {
  completeNoteImageUploadForCurrentUser,
  NoteImageError,
} from "@/lib/notes/images";
import type { CompleteNoteImageUploadInput } from "@/lib/notes/types";

function toErrorResponse(error: unknown) {
  if (error instanceof NoteImageError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    { error: "Unable to finalize this image upload right now." },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await context.params;
    const body = (await request.json()) as CompleteNoteImageUploadInput;

    if (!body?.imageId) {
      return NextResponse.json(
        { error: "Image id is required." },
        { status: 400 }
      );
    }

    const result = await completeNoteImageUploadForCurrentUser(noteId, body.imageId, {
      confirmUrl: body.confirmUrl ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
