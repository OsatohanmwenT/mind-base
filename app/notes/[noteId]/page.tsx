import { notFound, redirect } from "next/navigation";

import { buildSignInPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getNoteByIdForCurrentUser,
  listSuggestedTagsForCurrentUser,
} from "@/lib/notes/server";
import { NoteEditorShell } from "@/components/notes/note-editor-shell";

interface NoteEditorPageProps {
  params: Promise<{ noteId: string }>;
}

export default async function NoteEditorPage({ params }: NoteEditorPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    const { noteId } = await params;
    redirect(buildSignInPath(`/notes/${noteId}`));
  }

  const { noteId } = await params;
  const [note, suggestedTags] = await Promise.all([
    getNoteByIdForCurrentUser(noteId),
    listSuggestedTagsForCurrentUser(),
  ]);

  if (!note) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.55_0.03_185_/_0.07),transparent_60%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <NoteEditorShell initialNote={note} suggestedTags={suggestedTags} />
      </div>
    </main>
  );
}
