"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlaylistEditor from "./PlaylistEditor";

interface Props {
  playlist: any;
  isOwner: boolean;
  fromNew?: boolean;
}

export default function PlaylistOverlay({ playlist, isOwner, fromNew }: Props) {
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function dismiss(pushTo?: string) {
    if (pushTo) {
      router.push(pushTo);
    } else if (fromNew) {
      router.push(`/${playlist.profiles.username}`);
    } else {
      router.back();
    }
  }

  return (
    <main
      className={`fixed inset-0 z-50 bg-surface-base overflow-y-auto p-[var(--space-page-sm)] lg:pb-0 max-w-[var(--app-max-width)] mx-auto`}
    >
      <PlaylistEditor
        playlist={playlist}
        isOwner={isOwner}
        fromNew={fromNew}
        onClose={dismiss}
      />
    </main>
  );
}
