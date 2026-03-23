export const MAX_NOTE_TAGS = 10;
export const MAX_NOTE_TAG_LENGTH = 40;

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const rawTag of rawTags) {
    const normalized = normalizeTag(rawTag);

    if (!normalized || normalized.length > MAX_NOTE_TAG_LENGTH) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedTags.push(normalized);

    if (normalizedTags.length === MAX_NOTE_TAGS) {
      break;
    }
  }

  return normalizedTags;
}

export function countWords(content: string): number {
  const trimmed = content.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function getNoteDisplayTitle(title: string): string {
  return title.trim() || "Untitled note";
}
