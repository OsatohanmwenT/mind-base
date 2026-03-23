import { redirect } from "next/navigation";

import { buildSignInPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listNotesForCurrentUser,
  listUsedTagsForCurrentUser,
} from "@/lib/notes/server";
import { WorkspaceHeader } from "@/components/notes/workspace-header";
import { NotesWorkspace } from "@/components/notes/notes-workspace";

export default async function NotesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildSignInPath("/notes"));
  }

  const [notes, allTags] = await Promise.all([
    listNotesForCurrentUser(),
    listUsedTagsForCurrentUser(),
  ]);

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.55_0.03_185_/_0.07),transparent_60%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <WorkspaceHeader />
        <NotesWorkspace notes={notes} allTags={allTags} />
      </div>
    </main>
  );
}
