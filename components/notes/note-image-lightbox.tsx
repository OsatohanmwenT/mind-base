"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  id: string;
  readUrl: string;
  originalFilename: string;
}

interface NoteImageLightboxProps {
  images: LightboxImage[];
  initialImageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteImageLightbox({
  images,
  initialImageId,
  open,
  onOpenChange,
}: NoteImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const idx = images.findIndex((img) => img.id === initialImageId);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [initialImageId, open, images]);

  const safeIndex = Math.min(currentIndex, Math.max(0, images.length - 1));
  const currentImage = images[safeIndex] ?? null;
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < images.length - 1;

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center outline-none"
          aria-label="Image viewer"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              goToPrev();
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              goToNext();
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Image viewer
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Viewing attached image{images.length > 1 ? ` ${safeIndex + 1} of ${images.length}` : ""}.
            {images.length > 1 ? " Use arrow keys to navigate." : ""}
          </DialogPrimitive.Description>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close image viewer"
          >
            <X className="size-5" />
          </button>

          {images.length > 1 && (
            <div className="absolute top-5 left-1/2 z-10 -translate-x-1/2 font-mono text-sm tabular-nums text-white/60">
              {safeIndex + 1} / {images.length}
            </div>
          )}

          {currentImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={currentImage.id}
              src={currentImage.readUrl}
              alt={currentImage.originalFilename}
              className="max-h-[85dvh] max-w-[90vw] rounded object-contain sm:max-w-[85vw]"
              draggable={false}
            />
          )}

          {currentImage && (
            <p className="mt-3 max-w-[80vw] truncate text-center font-mono text-xs text-white/40">
              {currentImage.originalFilename}
            </p>
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goToPrev}
                disabled={!hasPrev}
                className={cn(
                  "absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors sm:left-4",
                  hasPrev
                    ? "hover:bg-white/20 hover:text-white"
                    : "cursor-default opacity-30"
                )}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={!hasNext}
                className={cn(
                  "absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors sm:right-4",
                  hasNext
                    ? "hover:bg-white/20 hover:text-white"
                    : "cursor-default opacity-30"
                )}
                aria-label="Next image"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
