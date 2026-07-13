"use client";

import { useEffect, useRef, useState } from "react";
import {
  InvalidImageError,
  sanitizeAndCompressAvatar,
} from "./imageResize";
import { uploadProfilePhoto } from "./services/users";
import { toast } from "../components/ui/Toast";
import { Error as ErrorIcon } from "../components/ui/icons/Error";

interface PendingAvatar {
  blob: Blob;
  ext: string;
}

/**
 * Shared avatar picker/upload state for the onboarding and edit-profile
 * flows: photo preview, camera-sheet UI state, and the compress+sanitize+
 * upload pipeline, so both flows go through the exact same process.
 */
export function useAvatarUpload(initialUrl?: string) {
  const [photoPreview, setPhotoPreview] = useState(initialUrl ?? "");
  const [pending, setPending] = useState<PendingAvatar | null>(null);
  const [removed, setRemoved] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasCamera(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // EditProfileModal loads currentPhotoUrl asynchronously after mount, so
  // sync the preview once it arrives — but only if the user hasn't already
  // picked or removed a photo themselves in this session.
  useEffect(() => {
    if (!pending && !removed) {
      setPhotoPreview(initialUrl ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  // Clears any in-progress pick/remove — call when a modal reopens (it stays
  // mounted between opens) so a prior session's edits don't leak forward.
  function reset() {
    setPending(null);
    setRemoved(false);
    setPhotoPreview(initialUrl ?? "");
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const { blob, ext } = await sanitizeAndCompressAvatar(file);
      setPending({ blob, ext });
      setRemoved(false);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch (err) {
      if (err instanceof InvalidImageError) {
        toast({ icon: <ErrorIcon />, message: err.message });
      } else {
        toast({ icon: <ErrorIcon />, message: "Couldn't process this image — try a different file" });
      }
    }
  }

  function handleRemovePhoto() {
    setPending(null);
    setPhotoPreview("");
    setRemoved(true);
  }

  function handleAvatarClick() {
    if (hasCamera || photoPreview) {
      setIsPhotoSheetOpen((s) => !s);
    } else {
      uploadInputRef.current?.click();
    }
  }

  async function upload(userId: string): Promise<string> {
    if (pending) {
      return uploadProfilePhoto(userId, pending.blob, pending.ext, initialUrl);
    }
    if (removed) return "";
    return initialUrl ?? "";
  }

  return {
    photoPreview,
    hasCamera,
    isPhotoSheetOpen,
    setIsPhotoSheetOpen,
    uploadInputRef,
    captureInputRef,
    avatarRef,
    handlePhotoChange,
    handleRemovePhoto,
    handleAvatarClick,
    upload,
    reset,
  };
}
