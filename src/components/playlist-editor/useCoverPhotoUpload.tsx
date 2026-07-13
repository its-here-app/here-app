"use client";

import { useRef } from "react";
import { InvalidImageError, validateImageFile } from "@/lib/imageResize";
import { toast } from "@/components/ui/Toast";
import { Error as ErrorIcon } from "@/components/ui/icons/Error";

const COVER_MAX_BYTES = 10 * 1024 * 1024;

/** Shared wiring for the hidden file input behind a "Change cover photo" button. */
export function useCoverPhotoUpload(onSelect: (file: File) => void) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      await validateImageFile(file, COVER_MAX_BYTES);
      onSelect(file);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        toast({ icon: <ErrorIcon />, message: err.message });
      } else {
        toast({ icon: <ErrorIcon />, message: "Couldn't process this image — try a different file" });
      }
    }
  }

  return { coverInputRef, handleCoverSelect };
}
