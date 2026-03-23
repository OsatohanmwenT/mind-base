import { redirect } from "next/navigation";

import { buildSignInPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { listSuggestedTagsForCurrentUser } from "@/lib/notes/server";
import { NewNoteShell } from "@/components/notes/new-note-shell";

export default async function NewNotePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildSignInPath("/notes/new"));
  }

  const suggestedTags = await listSuggestedTagsForCurrentUser();

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.55_0.03_185_/_0.07),transparent_60%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <NewNoteShell suggestedTags={suggestedTags} />
      </div>
    </main>
  );
}
