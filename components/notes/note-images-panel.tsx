"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { NoteImageLightbox } from "./note-image-lightbox";

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
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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

  const viewableImages = useMemo(
    () =>
      images
        .filter((img) => img.status === "uploaded" && img.readUrl)
        .map((img) => ({
          id: img.id,
          readUrl: img.readUrl!,
          originalFilename: img.originalFilename,
        })),
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

  const handleOpenLightbox = useCallback((imageId: string) => {
    setLightboxImageId(imageId);
    setIsLightboxOpen(true);
  }, []);

  const handleLightboxOpenChange = useCallback((open: boolean) => {
    setIsLightboxOpen(open);
    if (!open) setLightboxImageId(null);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50">
            Images
          </p>
          <Badge variant="outline" className="font-mono text-[10px]">
            {activeImagesCount}/{MAX_NOTE_IMAGES}
          </Badge>
        </div>

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
          variant="ghost"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
          disabled={remainingSlots <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/4 px-2.5 py-1.5 text-[11px] text-destructive/90">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {images.length === 0 ? (
        <div
          className={cn(
            "rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
            isDragActive
              ? "border-primary/50 bg-primary/5"
              : "border-border/60 bg-muted/10"
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
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="h-4 w-4 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Drop images here or use the button above
            </p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-2 rounded-lg transition-colors",
            isDragActive && "bg-primary/5 ring-1 ring-primary/30"
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
          {images.map((image) => (
            <div key={image.id} className="group relative">
              <div
                className={cn(
                  "aspect-4/3 overflow-hidden rounded-lg bg-muted/30",
                  image.status === "uploaded" &&
                    image.readUrl &&
                    "cursor-pointer"
                )}
                onClick={() => {
                  if (image.status === "uploaded" && image.readUrl) {
                    handleOpenLightbox(image.id);
                  }
                }}
                role={
                  image.status === "uploaded" && image.readUrl
                    ? "button"
                    : undefined
                }
                tabIndex={
                  image.status === "uploaded" && image.readUrl ? 0 : undefined
                }
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === " ") &&
                    image.status === "uploaded" &&
                    image.readUrl
                  ) {
                    e.preventDefault();
                    handleOpenLightbox(image.id);
                  }
                }}
                aria-label={
                  image.status === "uploaded" && image.readUrl
                    ? `View ${image.originalFilename}`
                    : undefined
                }
              >
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
                ) : image.status === "pending" ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span className="font-mono text-[10px]">
                        {image.uploadProgress ?? 0}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-destructive/70" />
                      <span className="line-clamp-2 text-[10px] text-muted-foreground">
                        {image.lastError || "Failed"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "absolute top-1 right-1 flex gap-0.5",
                  image.status === "failed"
                    ? "opacity-100"
                    : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                )}
              >
                {image.status === "failed" && image.sourceFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRetryImage(image.id);
                    }}
                    className="flex size-6 items-center justify-center rounded-md bg-background/90 ring-1 ring-foreground/10 text-muted-foreground hover:text-foreground"
                    aria-label="Retry upload"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
                {image.status === "uploaded" && !image.readUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void refreshReadUrl(image.id).catch((error) => {
                        setErrorMessage(
                          error instanceof Error
                            ? error.message
                            : "Unable to refresh that image right now."
                        );
                      });
                    }}
                    className="flex size-6 items-center justify-center rounded-md bg-background/90 ring-1 ring-foreground/10 text-muted-foreground hover:text-foreground"
                    aria-label="Refresh image"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRemoveImage(image.id);
                  }}
                  disabled={image.isDeleting}
                  className="flex size-6 items-center justify-center rounded-md bg-background/90 ring-1 ring-foreground/10 text-muted-foreground hover:text-destructive/80"
                  aria-label={`Remove ${image.originalFilename}`}
                >
                  {image.isDeleting ? (
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <NoteImageLightbox
        images={viewableImages}
        initialImageId={lightboxImageId}
        open={isLightboxOpen}
        onOpenChange={handleLightboxOpenChange}
      />
    </div>
  );
}
