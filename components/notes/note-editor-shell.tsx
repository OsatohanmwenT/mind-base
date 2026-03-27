"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

import {
  applyAutoOrganizeAction,
  generateAutoOrganizeSuggestionAction,
  updateNoteAction,
} from "@/app/notes/actions";
import { AUTO_ORGANIZE_MIN_WORD_COUNT } from "@/lib/notes/auto-organize-shared";
import type {
  AutoOrganizeModelOption,
  AutoOrganizeSuggestion,
  Note,
  NoteImage,
} from "@/lib/notes/types";
import {
  MAX_NOTE_TAG_LENGTH,
  MAX_NOTE_TAGS,
  countWords,
  normalizeTag,
} from "@/lib/notes/normalization";
import { Card, CardContent } from "@/components/ui/card";

import { NoteAutoOrganizeDialog } from "./note-auto-organize-dialog";
import { NoteEditorHeader } from "./note-editor-header";
import { NoteEditorMeta } from "./note-editor-meta";
import { NoteImagesPanel } from "./note-images-panel";
import { NewNoteTagsInput } from "./new-note-tags-input";

const AUTOSAVE_DEBOUNCE_MS = 800;

interface NoteEditorShellProps {
  initialNote: Note;
  initialImages: NoteImage[];
  suggestedTags: string[];
  autoOrganizeModels: AutoOrganizeModelOption[];
  preferredAutoOrganizeModelId: string | null;
  autoOrganizeError: string | null;
  initialAutoOrganizeOpen: boolean;
}

interface EditableNoteSnapshot {
  title: string;
  content: string;
  tags: string[];
}

function createSnapshot(
  note: Pick<Note, "title" | "content" | "tags" | "userTags">
): EditableNoteSnapshot {
  return {
    title: note.title,
    content: note.content,
    tags: note.userTags ?? note.tags,
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
  initialImages,
  suggestedTags,
  autoOrganizeModels,
  preferredAutoOrganizeModelId,
  autoOrganizeError: initialAutoOrganizeError,
  initialAutoOrganizeOpen,
}: NoteEditorShellProps) {
  const router = useRouter();

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    createSnapshot(initialNote)
  );
  const [title, setTitle] = useState(initialNote.title);
  const [content, setContent] = useState(initialNote.content);
  const [tags, setTags] = useState<string[]>(initialNote.userTags ?? initialNote.tags);
  const [aiTags, setAiTags] = useState<string[]>(initialNote.aiTags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialNote.updatedAt
  );
  const [hasSavedSinceLoad, setHasSavedSinceLoad] = useState(false);
  const [hasActiveUploads, setHasActiveUploads] = useState(false);
  const [noteStatus, setNoteStatus] = useState(initialNote.status);
  const [summary, setSummary] = useState(initialNote.summary);
  const [isAutoOrganizeOpen, setIsAutoOrganizeOpen] = useState(
    initialAutoOrganizeOpen
  );
  const [selectedAutoOrganizeModelId, setSelectedAutoOrganizeModelId] = useState<
    string | null
  >(
    preferredAutoOrganizeModelId ?? autoOrganizeModels[0]?.id ?? null
  );
  const [autoOrganizeSuggestion, setAutoOrganizeSuggestion] =
    useState<AutoOrganizeSuggestion | null>(null);
  const [autoOrganizeError, setAutoOrganizeError] = useState<string | null>(null);
  const [isGeneratingAutoOrganize, setIsGeneratingAutoOrganize] = useState(false);
  const [isApplyingAutoOrganize, setIsApplyingAutoOrganize] = useState(false);

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

  const autoOrganizeDisabledReason =
    initialAutoOrganizeError ??
    (wordCount < AUTO_ORGANIZE_MIN_WORD_COUNT
      ? `Write at least ${AUTO_ORGANIZE_MIN_WORD_COUNT} words before using auto-organize.`
      : null);
  const canAutoOrganize =
    !isSaving &&
    !isGeneratingAutoOrganize &&
    !isApplyingAutoOrganize &&
    !validationError &&
    !autoOrganizeDisabledReason &&
    autoOrganizeModels.length > 0;

  const draftRef = useRef(draftSnapshot);
  const savedSnapshotRef = useRef(savedSnapshot);
  const validationErrorRef = useRef(validationError);
  const isSavingRef = useRef(false);
  const queuedSaveModeRef = useRef<"manual" | "autosave" | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const latestAppliedRequestIdRef = useRef(0);
  const autoOpenHandledRef = useRef(false);

  useEffect(() => {
    draftRef.current = draftSnapshot;
  }, [draftSnapshot]);

  useEffect(() => {
    savedSnapshotRef.current = savedSnapshot;
  }, [savedSnapshot]);

  useEffect(() => {
    validationErrorRef.current = validationError;
  }, [validationError]);

  useEffect(() => {
    if (selectedAutoOrganizeModelId) {
      const stillAvailable = autoOrganizeModels.some(
        (model) => model.id === selectedAutoOrganizeModelId
      );

      if (stillAvailable) {
        return;
      }
    }

    setSelectedAutoOrganizeModelId(
      preferredAutoOrganizeModelId ?? autoOrganizeModels[0]?.id ?? null
    );
  }, [
    autoOrganizeModels,
    preferredAutoOrganizeModelId,
    selectedAutoOrganizeModelId,
  ]);

  useEffect(() => {
    if (!initialAutoOrganizeOpen || autoOpenHandledRef.current) {
      return;
    }

    autoOpenHandledRef.current = true;
    setIsAutoOrganizeOpen(true);
  }, [initialAutoOrganizeOpen]);

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
        return false;
      }

      if (areSnapshotsEqual(draftRef.current, savedSnapshotRef.current)) {
        setSaveError(null);
        return true;
      }

      if (isSavingRef.current) {
        queuedSaveModeRef.current =
          mode === "manual" || queuedSaveModeRef.current === "manual"
            ? "manual"
            : "autosave";
        return false;
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
          return false;
        }

        latestAppliedRequestIdRef.current = requestId;

        if (result.error || !result.note) {
          setSaveError(result.error ?? "Unable to save your note right now.");
          return false;
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
        setNoteStatus(result.note.status);
        setAiTags(result.note.aiTags ?? []);

        if (draftStillMatchesRequest) {
          draftRef.current = confirmedSnapshot;
          setTitle(confirmedSnapshot.title);
          setContent(confirmedSnapshot.content);
          setTags(confirmedSnapshot.tags);
        }

        return true;
      } catch {
        setSaveError("Unable to save your note right now.");
        return false;
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
    if (
      !isDirty &&
      !isSaving &&
      !hasActiveUploads &&
      !isGeneratingAutoOrganize &&
      !isApplyingAutoOrganize
    ) {
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
  }, [
    hasActiveUploads,
    isApplyingAutoOrganize,
    isDirty,
    isGeneratingAutoOrganize,
    isSaving,
  ]);

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = normalizeTag(tag);

      if (
        normalized &&
        normalized.length <= MAX_NOTE_TAG_LENGTH &&
        !tags.includes(normalized) &&
        !aiTags.includes(normalized) &&
        tags.length + aiTags.length < MAX_NOTE_TAGS
      ) {
        setTags((prev) => sortTags([...prev, normalized]));
      }
    },
    [aiTags, tags]
  );

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSave = useCallback(() => {
    void requestSave("manual");
  }, [requestSave]);

  const handleBack = useCallback(() => {
    if (
      (isDirty ||
        isSaving ||
        hasActiveUploads ||
        isGeneratingAutoOrganize ||
        isApplyingAutoOrganize) &&
      !window.confirm(
        hasActiveUploads
          ? "An image upload is still in progress. Leave this note?"
          : "You have unsaved changes. Leave this note?"
      )
    ) {
      return;
    }

    router.push("/notes");
  }, [
    hasActiveUploads,
    isApplyingAutoOrganize,
    isDirty,
    isGeneratingAutoOrganize,
    isSaving,
    router,
  ]);

  const handleOpenAutoOrganize = useCallback(() => {
    if (!canAutoOrganize) {
      return;
    }

    setAutoOrganizeError(null);
    setIsAutoOrganizeOpen(true);
  }, [canAutoOrganize]);

  const handleGenerateAutoOrganize = useCallback(async () => {
    if (!selectedAutoOrganizeModelId) {
      setAutoOrganizeError("Choose an AI model before running auto-organize.");
      return;
    }

    setIsAutoOrganizeOpen(true);
    setAutoOrganizeError(null);
    setAutoOrganizeSuggestion(null);

    if (isDirty) {
      const didSave = await requestSave("manual");

      if (!didSave) {
        setAutoOrganizeError("Save your latest changes before running auto-organize.");
        return;
      }
    }

    setIsGeneratingAutoOrganize(true);

    try {
      const result = await generateAutoOrganizeSuggestionAction({
        noteId: initialNote.id,
        modelId: selectedAutoOrganizeModelId,
      });

      if (result.error || !result.suggestion) {
        setAutoOrganizeError(
          result.error ?? "Unable to auto-organize this note right now."
        );
        return;
      }

      setAutoOrganizeSuggestion(result.suggestion);
    } catch {
      setAutoOrganizeError("Unable to auto-organize this note right now.");
    } finally {
      setIsGeneratingAutoOrganize(false);
    }
  }, [initialNote.id, isDirty, requestSave, selectedAutoOrganizeModelId]);

  const handleApplyAutoOrganize = useCallback(async () => {
    if (!autoOrganizeSuggestion) {
      return;
    }

    setIsApplyingAutoOrganize(true);
    setAutoOrganizeError(null);

    try {
      const result = await applyAutoOrganizeAction({
        noteId: initialNote.id,
        sourceHash: autoOrganizeSuggestion.sourceHash,
        title: autoOrganizeSuggestion.title,
        summary: autoOrganizeSuggestion.summary,
        tags: autoOrganizeSuggestion.tags,
      });

      if (result.error || !result.note) {
        setAutoOrganizeError(
          result.error ?? "Unable to apply the auto-organize suggestions."
        );
        return;
      }

      const confirmedSnapshot = createSnapshot(result.note);
      setSavedSnapshot(confirmedSnapshot);
      savedSnapshotRef.current = confirmedSnapshot;
      draftRef.current = confirmedSnapshot;
      setTitle(result.note.title);
      setContent(result.note.content);
      setTags(result.note.userTags ?? []);
      setAiTags(result.note.aiTags ?? []);
      setNoteStatus(result.note.status);
      setSummary(result.note.summary);
      setLastSavedAt(result.note.updatedAt);
      setHasSavedSinceLoad(true);
      setSaveError(null);
      setAutoOrganizeSuggestion(null);
      setIsAutoOrganizeOpen(false);
    } catch {
      setAutoOrganizeError("Unable to apply the auto-organize suggestions.");
    } finally {
      setIsApplyingAutoOrganize(false);
    }
  }, [autoOrganizeSuggestion, initialNote.id]);

  return (
    <div className="flex flex-col gap-6">
      <NoteEditorHeader
        saveState={saveState}
        isDirty={isDirty}
        saveError={saveError}
        lastSavedAt={lastSavedAt}
        canSave={
          isDirty &&
          !isSaving &&
          !isGeneratingAutoOrganize &&
          !isApplyingAutoOrganize
        }
        canAutoOrganize={Boolean(canAutoOrganize)}
        autoOrganizeDisabledReason={autoOrganizeDisabledReason}
        onBack={handleBack}
        onSave={handleSave}
        onAutoOrganize={handleOpenAutoOrganize}
      />

      <NoteAutoOrganizeDialog
        open={isAutoOrganizeOpen}
        onOpenChange={setIsAutoOrganizeOpen}
        models={autoOrganizeModels}
        selectedModelId={selectedAutoOrganizeModelId}
        onSelectedModelIdChange={setSelectedAutoOrganizeModelId}
        suggestion={autoOrganizeSuggestion}
        error={autoOrganizeError}
        isGenerating={isGeneratingAutoOrganize}
        isApplying={isApplyingAutoOrganize}
        minWordCount={AUTO_ORGANIZE_MIN_WORD_COUNT}
        wordCount={wordCount}
        featureError={initialAutoOrganizeError}
        canGenerate={
          Boolean(selectedAutoOrganizeModelId) &&
          wordCount >= AUTO_ORGANIZE_MIN_WORD_COUNT &&
          !initialAutoOrganizeError
        }
        onGenerate={handleGenerateAutoOrganize}
        onApply={handleApplyAutoOrganize}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Primary column: Editor */}
        <div className="min-w-0">
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
                className="w-full min-h-[280px] text-sm leading-relaxed bg-transparent outline-none resize-none placeholder:text-muted-foreground/30 sm:min-h-[400px] xl:min-h-[520px]"
                aria-label="Note content"
              />

              {validationError && (
                <p className="mt-1 text-xs text-destructive/80">
                  {validationError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary column: Sidebar */}
        <Card className="overflow-y-auto xl:sticky xl:top-8 xl:self-start xl:max-h-[calc(100dvh-4rem)] scrollbar-thin">
          <CardContent className="flex flex-col gap-0 pt-5">
            <NoteEditorMeta
              status={noteStatus}
              wordCount={wordCount}
              readingTime={readingTime}
              saveState={saveState}
              lastSavedAt={lastSavedAt}
              summary={summary}
              hasActiveUploads={hasActiveUploads}
              isGeneratingAutoOrganize={isGeneratingAutoOrganize}
            />

            <div className="border-t border-border/40 my-4" />

            <NewNoteTagsInput
              tags={tags}
              aiTags={aiTags}
              tagInput={tagInput}
              suggestedTags={suggestedTags}
              onTagInputChange={setTagInput}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />

            <div className="border-t border-border/40 my-4" />

            <NoteImagesPanel
              noteId={initialNote.id}
              initialImages={initialImages}
              onUploadActivityChange={setHasActiveUploads}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
