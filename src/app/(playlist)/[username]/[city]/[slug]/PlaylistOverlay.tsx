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
    let referrerPath = withinAppReferrerPath();
    // A referrer that's the same URL we're already on (e.g. this page was
    // reloaded, or was reached via a link pointing at itself) makes
    // router.push a no-op — nothing would happen when clicking Close.
    if (referrerPath === `${window.location.pathname}${window.location.search}`) {
      referrerPath = null;
    }
    // (playlist) and (main) are separate root layouts (each with their own
    // html/body), so this close always crosses a root-layout boundary.
    // router.back() drives that via popstate, which doesn't reliably force
    // the full reload Next does for push/Link across root layouts — it can
    // leave shared chrome (Sidebar/BottomNav/AppShell) half-mounted and
    // serve stale Router Cache data. Always push instead.
    router.push(referrerPath ?? `/${playlist.profiles.username}`);
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
