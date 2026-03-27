import { notFound, redirect } from "next/navigation";

import { buildSignInPath } from "@/lib/auth/redirects";
import { readAuthCookies } from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/session";
import { getAutoOrganizeAvailability } from "@/lib/notes/auto-organize";
import { listNoteImagesForCurrentUser } from "@/lib/notes/images";
import {
  getNoteByIdForCurrentUser,
  listSuggestedTagsForCurrentUser,
} from "@/lib/notes/server";
import { NoteEditorShell } from "@/components/notes/note-editor-shell";

interface NoteEditorPageProps {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NoteEditorPage({
  params,
  searchParams,
}: NoteEditorPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    const { noteId } = await params;
    redirect(buildSignInPath(`/notes/${noteId}`));
  }

  const { noteId } = await params;
  const { accessToken } = await readAuthCookies();
  const requestedAutoOpen = await searchParams;
  const [note, suggestedTags, autoOrganizeAvailability] = await Promise.all([
    getNoteByIdForCurrentUser(noteId),
    listSuggestedTagsForCurrentUser(),
    accessToken
      ? getAutoOrganizeAvailability(accessToken)
      : Promise.resolve({
          models: [],
          preferredModelId: null,
          error: "Auto-organize is unavailable right now.",
        }),
  ]);

  if (!note) {
    notFound();
  }

  const initialImages = await listNoteImagesForCurrentUser(noteId, {
    includeReadUrls: true,
  });

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.55_0.03_185/0.07),transparent_60%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <NoteEditorShell
          initialNote={note}
          initialImages={initialImages}
          suggestedTags={suggestedTags}
          autoOrganizeModels={autoOrganizeAvailability.models}
          preferredAutoOrganizeModelId={autoOrganizeAvailability.preferredModelId}
          autoOrganizeError={autoOrganizeAvailability.error}
          initialAutoOrganizeOpen={requestedAutoOpen.autoOrganize === "1"}
        />
      </div>
    </main>
  );
}
