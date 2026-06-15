"use client";

import { useState, useEffect, useRef } from "react";
import { useSaves } from "@/lib/savesContext";
import { useAuth } from "@/lib/authContext";
import { isPlaylistSaved, savePlaylist, unsavePlaylist } from "@/lib/services/saves";
import type { DraftSpot } from "@/types";
import { IconButton } from "@/components/ui/IconButton";
import type { IconButtonVariant } from "@/components/ui/IconButton";
import { Bookmark } from "@/components/ui/icons/Bookmark";
import { snackbar } from "@/components/ui/Snackbar";
import { Info } from "@/components/ui/icons/Info";

type SpotProps = { spot: DraftSpot; playlistId?: never; variant?: IconButtonVariant; className?: string; onRemove?: () => void; onRestore?: () => void };
type PlaylistProps = { playlistId: string; spot?: never; variant?: IconButtonVariant; className?: string; onRemove?: () => void; onRestore?: () => void };

export default function BookmarkButton({ spot, playlistId, variant = "ghost", className, onRemove, onRestore }: SpotProps | PlaylistProps) {
  const { isSaved, toggle } = useSaves();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [playlistSaved, setPlaylistSaved] = useState(false);
  const [loading, setLoading] = useState(!!playlistId);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [animating, setAnimating] = useState(false);
  const prevActiveRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!playlistId || !user) { setLoading(false); return; }
    isPlaylistSaved(user.id, playlistId).then((v) => {
      setPlaylistSaved(v);
      setLoading(false);
    });
  }, [user, playlistId]);

  async function togglePlaylist() {
    if (!user || loading || !playlistId) return;
    if (playlistSaved) {
      setPlaylistSaved(false);
      onRemove?.();
      snackbar({
        icon: <Info />,
        message: "Playlist removed from saves",
        actionLabel: "Undo",
        onAction: () => { setPlaylistSaved(true); onRestore?.(); },
        onDismiss: async () => {
          try {
            await unsavePlaylist(user.id, playlistId);
          } catch {
            setPlaylistSaved(true);
            onRestore?.();
          }
        },
      });
    } else {
      setPlaylistSaved(true);
      try {
        await savePlaylist(user.id, playlistId);
      } catch {
        setPlaylistSaved(false);
      }
    }
  }

  const saved = mounted && (playlistId
    ? playlistSaved
    : savedOverride !== null
      ? savedOverride
      : isSaved(spot!.google_place_id));

  useEffect(() => {
    if (saved && !prevActiveRef.current) setAnimating(true);
    prevActiveRef.current = saved;
  }, [saved]);

  const icon = (
    <span
      className={animating ? "animate-bookmark-pop" : ""}
      onAnimationEnd={() => setAnimating(false)}
    >
      <Bookmark active={saved} />
    </span>
  );

  if (playlistId) {
    if (!user || loading) return null;
    return (
      <IconButton
        variant={variant}
        icon={icon}
        label={saved ? "Remove from saves" : "Save playlist"}
        onClick={togglePlaylist}
        className={className}
      />
    );
  }

  function handleSpotClick() {
    if (saved) {
      if (onRemove) {
        setSavedOverride(false);
        onRemove();
        snackbar({
          icon: <Info />,
          message: "Spot removed from saves",
          actionLabel: "Undo",
          onAction: () => { setSavedOverride(null); onRestore?.(); },
          onDismiss: () => { toggle(spot!); setSavedOverride(null); },
        });
      } else {
        setSavedOverride(false);
        snackbar({
          icon: <Info />,
          message: "Spot removed from saves",
          actionLabel: "Undo",
          onAction: () => setSavedOverride(null),
          onDismiss: () => { toggle(spot!); setSavedOverride(null); },
        });
      }
    } else {
      toggle(spot!);
    }
  }

  return (
    <IconButton
      variant={variant}
      icon={icon}
      label={saved ? "Remove from saves" : "Save spot"}
      onClick={handleSpotClick}
      className={className}
    />
  );
}
