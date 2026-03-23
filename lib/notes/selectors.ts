import type { Note, SortMode } from "./types";
import { getNoteDisplayTitle } from "./normalization";

export function filterNotes(
  notes: Note[],
  query: string,
  activeTags: string[]
): Note[] {
  let result = notes;

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (activeTags.length > 0) {
    result = result.filter((n) =>
      activeTags.every((tag) => n.tags.includes(tag))
    );
  }

  return result;
}

export function sortNotes(notes: Note[], mode: SortMode): Note[] {
  const sorted = [...notes];

  switch (mode) {
    case "updated":
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      break;
    case "created":
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
    case "alpha":
      sorted.sort((a, b) =>
        getNoteDisplayTitle(a.title).localeCompare(getNoteDisplayTitle(b.title))
      );
      break;
  }

  const pinned = sorted.filter((n) => n.isPinned);
  const unpinned = sorted.filter((n) => !n.isPinned);
  return [...pinned, ...unpinned];
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
