"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

import {
  MAX_NOTE_IMAGES,
  MAX_NOTE_IMAGE_SIZE_BYTES,
  NOTE_IMAGE_ACCEPTED_MIME_TYPES,
} from "@/lib/notes/image-validation";
import { cn } from "@/lib/utils";
import type {
  CompleteNoteImageUploadResult,
  DeleteNoteImageResult,
  FailNoteImageUploadResult,
  NoteImage,
  RefreshNoteImageReadUrlResult,
  RequestNoteImageUploadResult,
} from "@/lib/notes/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NoteImagesPanelProps {
  noteId: string;
  initialImages: NoteImage[];
  onUploadActivityChange?: (hasActiveUploads: boolean) => void;
}

interface NoteImageCardState extends NoteImage {
  uploadProgress: number | null;
  confirmUrl: string | null;
  isDeleting: boolean;
  sourceFile: File | null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toImageCardState(image: NoteImage): NoteImageCardState {
  return {
    ...image,
    uploadProgress: image.status === "uploaded" ? 100 : null,
    confirmUrl: null,
    isDeleting: false,
    sourceFile: null,
  };
}

function sortImages(images: NoteImageCardState[]) {
  return [...images].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? payload.error || "Request failed."
        : "Request failed."
    );
  }

  return payload as T;
}

function uploadFileToStorage(
  input: {
    uploadUrl: string;
    fields: Record<string, string>;
  },
  file: File,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const formData = new FormData();

    Object.entries(input.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", input.uploadUrl);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Storage upload failed."));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Storage upload failed."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Storage upload was cancelled."));
    });

    xhr.send(formData);
  });
}

export function NoteImagesPanel({
  noteId,
  initialImages,
  onUploadActivityChange,
}: NoteImagesPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const refreshedReadUrlIdsRef = useRef<Set<string>>(new Set());

  const [images, setImages] = useState<NoteImageCardState[]>(() =>
    sortImages(initialImages.map(toImageCardState))
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const activeImagesCount = useMemo(
    () => images.filter((image) => image.status !== "failed").length,
    [images]
  );
  const remainingSlots = Math.max(0, MAX_NOTE_IMAGES - activeImagesCount);
  const hasActiveUploads = useMemo(
    () =>
      images.some(
        (image) => image.status === "pending" && image.sourceFile !== null
      ),
    [images]
  );

  useEffect(() => {
    onUploadActivityChange?.(hasActiveUploads);
  }, [hasActiveUploads, onUploadActivityChange]);

  function updateImage(
    imageId: string,
    updater: (image: NoteImageCardState) => NoteImageCardState
  ) {
    setImages((currentImages) =>
      sortImages(
        currentImages.map((image) =>
          image.id === imageId ? updater(image) : image
        )
      )
    );
  }

  async function refreshReadUrl(imageId: string) {
    const result = await requestJson<RefreshNoteImageReadUrlResult>(
      `/api/notes/${noteId}/images/${imageId}/read-url`,
      {
        method: "POST",
      }
    );

    updateImage(imageId, (image) => ({
      ...image,
      readUrl: result.readUrl,
      readUrlExpiresAt: result.expiresAt,
      lastError: null,
    }));
  }

  async function markUploadFailed(imageId: string, message: string) {
    try {
      const result = await requestJson<FailNoteImageUploadResult>(
        `/api/notes/${noteId}/images/${imageId}/fail`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageId,
            error: message,
          }),
        }
      );

      updateImage(imageId, (image) => ({
        ...image,
        ...toImageCardState(result.image),
        sourceFile: image.sourceFile,
      }));
    } catch {
      updateImage(imageId, (image) => ({
        ...image,
        status: "failed",
        uploadProgress: null,
        confirmUrl: null,
        lastError: message,
      }));
    }
  }

  async function beginUpload(file: File) {
    const reservation = await requestJson<RequestNoteImageUploadResult>(
      `/api/notes/${noteId}/images/upload-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      }
    );

    const optimisticImage: NoteImageCardState = {
      ...toImageCardState(reservation.image),
      confirmUrl: reservation.upload.confirmUrl,
      sourceFile: file,
      uploadProgress: 0,
    };

    setImages((currentImages) => sortImages([...currentImages, optimisticImage]));

    try {
      await uploadFileToStorage(
        {
          uploadUrl: reservation.upload.uploadUrl,
          fields: reservation.upload.fields,
        },
        file,
        (progress) => {
          updateImage(reservation.image.id, (image) => ({
            ...image,
            uploadProgress: progress,
          }));
        }
      );

      const completed = await requestJson<CompleteNoteImageUploadResult>(
        `/api/notes/${noteId}/images/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageId: reservation.image.id,
            confirmUrl: reservation.upload.confirmUrl,
          }),
        }
      );

      updateImage(reservation.image.id, () => ({
        ...toImageCardState(completed.image),
        uploadProgress: 100,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload that image right now.";

      await markUploadFailed(reservation.image.id, message);
      setErrorMessage(message);
    }
  }

  function queueFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    setErrorMessage(null);

    if (remainingSlots <= 0) {
      setErrorMessage("This note already has the maximum 10 images.");
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots);

    if (acceptedFiles.length < files.length) {
      setErrorMessage("Only the first 10 images for this note can be uploaded.");
    }

    acceptedFiles.forEach((file) => {
      void beginUpload(file).catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to upload that image right now."
        );
      });
    });
  }

  async function handleRemoveImage(imageId: string) {
    setErrorMessage(null);
    updateImage(imageId, (image) => ({
      ...image,
      isDeleting: true,
    }));

    try {
      const result = await requestJson<DeleteNoteImageResult>(
        `/api/notes/${noteId}/images/${imageId}`,
        {
          method: "DELETE",
        }
      );

      setImages((currentImages) =>
        currentImages.filter((image) => image.id !== result.imageId)
      );
      return true;
    } catch (error) {
      updateImage(imageId, (image) => ({
        ...image,
        isDeleting: false,
      }));
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove that image right now."
      );
      return false;
    }
  }

  async function handleRetryImage(imageId: string) {
    const image = images.find((item) => item.id === imageId);

    if (!image?.sourceFile) {
      setErrorMessage("That upload can no longer be retried automatically.");
      return;
    }

    const removed = await handleRemoveImage(imageId);

    if (!removed) {
      setErrorMessage("Unable to retry that image upload right now.");
      return;
    }

    void beginUpload(image.sourceFile).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to retry that image upload right now."
      );
    });
  }

  const acceptedTypesLabel = NOTE_IMAGE_ACCEPTED_MIME_TYPES.map((type) =>
    type.replace("image/", "").toUpperCase()
  ).join(", ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Images</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {activeImagesCount}/{MAX_NOTE_IMAGES}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Add lightweight screenshots or reference images to this note.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={NOTE_IMAGE_ACCEPTED_MIME_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  queueFiles(event.target.files);
                }

                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[13px]"
              disabled={remainingSlots <= 0}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Add images
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-dashed px-4 py-5 transition-colors",
            isDragActive
              ? "border-primary/50 bg-primary/5"
              : "border-border/70 bg-muted/15"
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            if (event.dataTransfer.files?.length) {
              queueFiles(event.dataTransfer.files);
            }
          }}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/80">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Drop images here or choose files</p>
              <p className="text-xs text-muted-foreground">
                {acceptedTypesLabel} up to{" "}
                {formatFileSize(MAX_NOTE_IMAGE_SIZE_BYTES)} each, max {MAX_NOTE_IMAGES} per
                note
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/4 px-3 py-2 text-xs text-destructive/90">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {images.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
            No images attached yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-xl border border-border/70 bg-background/60"
              >
                <div className="relative aspect-4/3 bg-muted/30">
                  {image.status === "uploaded" && image.readUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URLs are generated at runtime.
                    <img
                      src={image.readUrl}
                      alt={image.originalFilename}
                      className="h-full w-full object-cover"
                      onError={() => {
                        if (refreshedReadUrlIdsRef.current.has(image.id)) {
                          return;
                        }

                        refreshedReadUrlIdsRef.current.add(image.id);
                        void refreshReadUrl(image.id).catch(() => {});
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      {image.status === "pending" ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          <span className="font-mono text-xs">
                            {image.uploadProgress ?? 0}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
                          <AlertCircle className="h-5 w-5 text-destructive/70" />
                          <span className="text-xs">
                            {image.lastError || "Upload failed."}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 p-3">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium">
                        {image.originalFilename}
                      </p>
                      <Badge
                        variant={image.status === "failed" ? "secondary" : "outline"}
                        className="font-mono text-[10px] capitalize"
                      >
                        {image.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(image.sizeBytes)} · {image.mimeType}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {image.status === "pending"
                        ? image.sourceFile
                          ? "Uploading to private storage"
                          : "Upload was interrupted before it finished."
                        : image.status === "failed"
                          ? "You can remove this image or retry the upload."
                          : "Stored privately for this note."}
                    </div>

                    <div className="flex items-center gap-2">
                      {image.status === "failed" && image.sourceFile && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 px-2 text-[12px]"
                          onClick={() => {
                            void handleRetryImage(image.id);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retry
                        </Button>
                      )}
                      {image.status === "uploaded" && !image.readUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 px-2 text-[12px]"
                          onClick={() => {
                            void refreshReadUrl(image.id).catch((error) => {
                              setErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to refresh that image right now."
                              );
                            });
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Refresh
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 px-2 text-[12px] text-muted-foreground"
                        disabled={image.isDeleting}
                        onClick={() => {
                          void handleRemoveImage(image.id);
                        }}
                      >
                        {image.isDeleting ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
