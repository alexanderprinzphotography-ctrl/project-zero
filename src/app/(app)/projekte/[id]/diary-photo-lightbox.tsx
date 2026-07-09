"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DiaryPhoto } from "@/core/diary/entry";

export function DiaryPhotoThumbnails({ photos }: { photos: DiaryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="h-20 w-20 overflow-hidden rounded-md border border-border"
          >
            {photo.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signierte Supabase-Storage-URL
              <img
                src={photo.signedUrl}
                alt="Tagebuch-Foto"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                Kein Zugriff
              </div>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {openIndex !== null && photos[openIndex]?.signedUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setOpenIndex(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signierte Supabase-Storage-URL */}
            <img
              src={photos[openIndex].signedUrl ?? undefined}
              alt="Tagebuch-Foto (Vollbild)"
              className="max-h-full max-w-full rounded-md object-contain"
            />
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white"
              aria-label="Schließen"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
