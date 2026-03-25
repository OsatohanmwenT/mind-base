"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

import { updateNoteAction } from "@/app/notes/actions";
import type { Note } from "@/lib/notes/types";
import {
  MAX_NOTE_TAG_LENGTH,
  MAX_NOTE_TAGS,
  countWords,
  normalizeTag,
} from "@/lib/notes/normalization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { NoteEditorHeader } from "./note-editor-header";
import { NewNoteTagsInput } from "./new-note-tags-input";

const AUTOSAVE_DEBOUNCE_MS = 800;

interface NoteEditorShellProps {
  initialNote: Note;
  suggestedTags: string[];
}

interface EditableNoteSnapshot {
  title: string;
  content: string;
  tags: string[];
}

function createSnapshot(note: Pick<Note, "title" | "content" | "tags">): EditableNoteSnapshot {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
  };
}

function areSnapshotsEqual(
  left: EditableNoteSnapshot,
  right: EditableNoteSnapshot
) {
  if (left.title !== right.title) return false;
  if (left.content !== right.content) return false;
  if (left.tags.length !== right.tags.length) return false;
  return left.tags.every((tag, index) => tag === right.tags[index]);
}

function sortTags(tags: string[]) {
  return [...tags].sort((left, right) => left.localeCompare(right));
}

export function NoteEditorShell({
  initialNote,
  suggestedTags,
}: NoteEditorShellProps) {
  const router = useRouter();

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    createSnapshot(initialNote)
  );
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content);
  const [tags, setTags] = useState<string[]>(initialNote.tags);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialNote.updatedAt
  );
  const [hasSavedSinceLoad, setHasSavedSinceLoad] = useState(false);

  const wordCount = useMemo(() => countWords(content), [content]);
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const validationError = content.trim()
    ? null
    : "Write some content before saving your note.";
  const draftSnapshot = useMemo(
    () => ({
      title,
      content,
      tags,
    }),
    [title, content, tags]
  );
  const isDirty = useMemo(
    () => !areSnapshotsEqual(draftSnapshot, savedSnapshot),
    [draftSnapshot, savedSnapshot]
  );
  const saveState = useMemo(() => {
    if (isSaving) return "saving";
    if (saveError) return "error";
    if (isDirty) return "dirty";
    if (hasSavedSinceLoad) return "saved";
    return "clean";
  }, [hasSavedSinceLoad, isDirty, isSaving, saveError]);

  const draftRef = useRef(draftSnapshot);
  const savedSnapshotRef = useRef(savedSnapshot);
  const validationErrorRef = useRef(validationError);
  const isSavingRef = useRef(false);
  const queuedSaveModeRef = useRef<"manual" | "autosave" | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const latestAppliedRequestIdRef = useRef(0);

  useEffect(() => {
    draftRef.current = draftSnapshot;
  }, [draftSnapshot]);

  useEffect(() => {
    savedSnapshotRef.current = savedSnapshot;
  }, [savedSnapshot]);

  useEffect(() => {
    validationErrorRef.current = validationError;
  }, [validationError]);

  const clearScheduledSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const requestSave = useCallback(
    async (mode: "manual" | "autosave") => {
      clearScheduledSave();

      if (validationErrorRef.current) {
        if (mode === "manual") {
          setSaveError(validationErrorRef.current);
        }
        return;
      }

      if (areSnapshotsEqual(draftRef.current, savedSnapshotRef.current)) {
        setSaveError(null);
        return;
      }

      if (isSavingRef.current) {
        queuedSaveModeRef.current =
          mode === "manual" || queuedSaveModeRef.current === "manual"
            ? "manual"
            : "autosave";
        return;
      }

      const requestId = requestIdRef.current + 1;
      const requestSnapshot = draftRef.current;

      requestIdRef.current = requestId;
      isSavingRef.current = true;
      setIsSaving(true);
      setSaveError(null);

      try {
        const result = await updateNoteAction({
          noteId: initialNote.id,
          title: requestSnapshot.title,
          content: requestSnapshot.content,
          tags: requestSnapshot.tags,
        });

        if (requestId < latestAppliedRequestIdRef.current) {
          return;
        }

        latestAppliedRequestIdRef.current = requestId;

        if (result.error || !result.note) {
          setSaveError(result.error ?? "Unable to save your note right now.");
          return;
        }

        const confirmedSnapshot = createSnapshot(result.note);
        const draftStillMatchesRequest = areSnapshotsEqual(
          draftRef.current,
          requestSnapshot
        );

        setSavedSnapshot(confirmedSnapshot);
        savedSnapshotRef.current = confirmedSnapshot;
        setLastSavedAt(result.note.updatedAt);
        setHasSavedSinceLoad(true);
        setSaveError(null);

        if (draftStillMatchesRequest) {
          draftRef.current = confirmedSnapshot;
          setTitle(confirmedSnapshot.title);
          setContent(confirmedSnapshot.content);
          setTags(confirmedSnapshot.tags);
        }
      } catch {
        setSaveError("Unable to save your note right now.");
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);

        const queuedMode = queuedSaveModeRef.current;
        queuedSaveModeRef.current = null;

        if (
          queuedMode &&
          !validationErrorRef.current &&
          !areSnapshotsEqual(draftRef.current, savedSnapshotRef.current)
        ) {
          if (queuedMode === "manual") {
            void requestSave("manual");
          } else {
            debounceTimeoutRef.current = setTimeout(() => {
              void requestSave("autosave");
            }, AUTOSAVE_DEBOUNCE_MS);
          }
        }
      }
    },
    [clearScheduledSave, initialNote.id]
  );

  useEffect(() => {
    if (isSaving) {
      return;
    }

    if (!isDirty || validationError) {
      clearScheduledSave();
      return;
    }

    clearScheduledSave();
    debounceTimeoutRef.current = setTimeout(() => {
      void requestSave("autosave");
    }, AUTOSAVE_DEBOUNCE_MS);

    return clearScheduledSave;
  }, [
    clearScheduledSave,
    content,
    isDirty,
    isSaving,
    requestSave,
    tags,
    title,
    validationError,
  ]);

  useEffect(() => {
    if (!isDirty && !isSaving) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSaving]);

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = normalizeTag(tag);

      if (
        normalized &&
        normalized.length <= MAX_NOTE_TAG_LENGTH &&
        !tags.includes(normalized) &&
        tags.length < MAX_NOTE_TAGS
      ) {
        setTags((prev) => sortTags([...prev, normalized]));
      }
    },
    [tags]
  );

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSave = useCallback(() => {
    void requestSave("manual");
  }, [requestSave]);

  const handleBack = useCallback(() => {
    if (
      (isDirty || isSaving) &&
      !window.confirm("You have unsaved changes. Leave this note?")
    ) {
      return;
    }

    router.push("/notes");
  }, [isDirty, isSaving, router]);

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
      <NoteEditorHeader
        status={initialNote.status}
        saveState={saveState}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
        canSave={isDirty && !isSaving}
        onBack={handleBack}
        onSave={handleSave}
      />

      <Card>
        <CardContent className="flex flex-col gap-0 pt-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Untitled note"
            className="w-full text-lg font-semibold tracking-tight bg-transparent outline-none placeholder:text-muted-foreground/30"
            aria-label="Note title"
            autoFocus
          />

          <div className="border-t border-border/40 my-3" />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing…"
            className="w-full min-h-[280px] text-sm leading-relaxed bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 sm:min-h-[400px]"
            aria-label="Note content"
          />
        </CardContent>
      </Card>

      {validationError && (
        <p className="text-xs text-destructive/80">{validationError}</p>
      )}

      <NewNoteTagsInput
        tags={tags}
        tagInput={tagInput}
        suggestedTags={suggestedTags}
        onTagInputChange={setTagInput}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
      />

      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/50">
        <Badge
          variant="outline"
          className="font-mono text-[10px] text-muted-foreground/60"
        >
          {initialNote.status}
        </Badge>
        <span className="font-mono">{wordCount} words</span>
        <span className="font-mono">&middot;</span>
        <span className="font-mono">{readingTime} min read</span>
        {saveState === "saving" && (
          <>
            <span className="font-mono">&middot;</span>
            <span className="font-mono text-primary/60">saving</span>
          </>
        )}
        {saveState === "error" && (
          <>
            <span className="font-mono">&middot;</span>
            <span className="font-mono text-destructive/70">save failed</span>
          </>
        )}
        {isDirty && saveState !== "saving" && (
          <>
            <span className="font-mono">&middot;</span>
            <span className="font-mono text-primary/60">local changes</span>
          </>
        )}
      </div>
    </div>
  );
}
