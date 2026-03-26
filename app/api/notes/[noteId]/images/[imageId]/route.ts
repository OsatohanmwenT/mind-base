import { NextResponse } from "next/server";

import { deleteNoteImageForCurrentUser, NoteImageError } from "@/lib/notes/images";

function toErrorResponse(error: unknown) {
  if (error instanceof NoteImageError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    { error: "Unable to remove this image right now." },
    { status: 500 }
  );
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ noteId: string; imageId: string }> }
) {
  try {
    const { noteId, imageId } = await context.params;
    const result = await deleteNoteImageForCurrentUser(noteId, imageId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
