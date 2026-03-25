import {
  createSearchParamsCache,
  parseAsNativeArrayOf,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

export const defaultNotesSortMode = "updated";

export const notesSortModes = ["updated", "created", "alpha"] as const;

export const notesSearchParams = {
  query: parseAsString
    .withDefault("")
    .withOptions({ history: "replace", shallow: false }),
  tag: parseAsNativeArrayOf(parseAsString).withOptions({
    history: "replace",
    shallow: false,
  }),
  sort: parseAsStringLiteral(notesSortModes)
    .withDefault(defaultNotesSortMode)
    .withOptions({ history: "replace", shallow: false }),
};

export const notesSearchParamsCache =
  createSearchParamsCache(notesSearchParams);

export type NotesSearchParams = inferParserType<typeof notesSearchParams>;
