"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PlaylistEditor from "./PlaylistEditor";
import { dismissAllSnackbars } from "@/components/ui/Snackbar";
import { useAuth } from "@/lib/authContext";

interface Props {
  playlist: any;
  isOwner: boolean;
  fromNew?: boolean;
}

export default function PlaylistOverlay({ playlist, isOwner, fromNew }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    dismissAllSnackbars();
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
      return;
    }
    if (loading) return;
    if (!user) {
      router.push("/signin");
      return;
    }
    if (fromNew) {
      router.push(`/${playlist.profiles.username}`);
      return;
    }
    const referrerPath = withinAppReferrerPath();
    if (!referrerPath) {
      router.push(`/${playlist.profiles.username}`);
    } else if (window.history.length > 1) {
      // There's a same-origin referrer *and* an entry to pop in this tab's
      // own history, so a real back() is safe — e.g. this rules out a link
      // opened in a new tab, where the referrer is same-origin but this
      // tab's history is empty and back() would be a no-op.
      router.back();
    } else {
      router.push(referrerPath);
    }
  }

  function withinAppReferrerPath(): string | null {
    if (!document.referrer) return null;
    try {
      const url = new URL(document.referrer);
      if (url.origin !== window.location.origin) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  return (
    <main
      className={`min-h-dvh bg-surface-base p-[var(--space-page-sm)] lg:pb-0 max-w-[var(--app-max-width)] mx-auto`}
    >
      <PlaylistEditor
        playlist={playlist}
        isOwner={isOwner}
        fromNew={fromNew}
        onClose={dismiss}
        closeReady={!loading}
      />
    </main>
  );
}
