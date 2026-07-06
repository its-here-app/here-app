"use client";

import { useRef } from "react";

/** Shared wiring for the hidden file input behind a "Change cover photo" button. */
export function useCoverPhotoUpload(onSelect: (file: File) => void) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onSelect(file);
  }

  return { coverInputRef, handleCoverSelect };
}
