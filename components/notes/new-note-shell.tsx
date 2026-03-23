"use client";

import { useActionState, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  createNoteAction,
  type CreateNoteActionState,
} from "@/app/notes/actions";
import {
  MAX_NOTE_TAG_LENGTH,
  MAX_NOTE_TAGS,
  countWords,
  normalizeTag,
} from "@/lib/notes/normalization";
import { NewNoteHeader } from "./new-note-header";
import { NewNoteForm } from "./new-note-form";

interface NewNoteShellProps {
  suggestedTags: string[];
}

const initialCreateNoteActionState: CreateNoteActionState = {
  error: null,
};

export function NewNoteShell({ suggestedTags }: NewNoteShellProps) {
  const router = useRouter();
  const [actionState, formAction, isPending] = useActionState(
    createNoteAction,
    initialCreateNoteActionState
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const wordCount = useMemo(() => countWords(content), [content]);

  const canSubmit = content.trim().length > 0;

  const contentError =
    hasAttemptedSubmit && !canSubmit
      ? "Write some content before creating your note."
      : undefined;

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = normalizeTag(tag);

      if (
        normalized &&
        normalized.length <= MAX_NOTE_TAG_LENGTH &&
        !tags.includes(normalized) &&
        tags.length < MAX_NOTE_TAGS
      ) {
        setTags((prev) => [...prev, normalized]);
      }
    },
    [tags]
  );

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  function handleCancel() {
    router.push("/notes");
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setHasAttemptedSubmit(true);

        if (!canSubmit) {
          event.preventDefault();
        }
      }}
      className="mx-auto w-full max-w-3xl flex flex-col gap-6"
    >
      <NewNoteHeader isSubmitting={isPending} onCancel={handleCancel} />
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
      <NewNoteForm
        title={title}
        content={content}
        tags={tags}
        tagInput={tagInput}
        wordCount={wordCount}
        suggestedTags={suggestedTags}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onTagInputChange={setTagInput}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        contentError={contentError}
        submitError={actionState.error}
      />
    </form>
  );
}
