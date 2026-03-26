import { NextResponse } from "next/server";

import {
  NoteImageError,
  requestNoteImageUploadForCurrentUser,
} from "@/lib/notes/images";
import type { RequestNoteImageUploadInput } from "@/lib/notes/types";

function toErrorResponse(error: unknown) {
  if (error instanceof NoteImageError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    { error: "Unable to create an image upload URL right now." },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await context.params;
    const body = (await request.json()) as RequestNoteImageUploadInput;
    const result = await requestNoteImageUploadForCurrentUser(noteId, body);

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
