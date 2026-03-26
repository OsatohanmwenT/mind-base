import { NextResponse } from "next/server";

import {
  NoteImageError,
  refreshNoteImageReadUrlForCurrentUser,
} from "@/lib/notes/images";

function toErrorResponse(error: unknown) {
  if (error instanceof NoteImageError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    { error: "Unable to refresh this image URL right now." },
    { status: 500 }
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ noteId: string; imageId: string }> }
) {
  try {
    const { noteId, imageId } = await context.params;
    const result = await refreshNoteImageReadUrlForCurrentUser(noteId, imageId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
