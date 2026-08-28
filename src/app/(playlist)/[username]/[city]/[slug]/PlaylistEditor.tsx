"use client";

import { useState, useRef, useEffect } from "react";
import { useShare } from "@/lib/useShare";
import { playlistDocTitle } from "@/lib/playlistDocTitle";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import {
  upsertSpot,
  addSpotToPlaylist,
  removeSpotFromPlaylist,
  reorderPlaylistSpots,
  updatePlaylistName,
  updatePlaylistDescription,
  updatePlaylistVisibility,
  updateSpotNotes,
  uploadPlaylistCover,
  touchPlaylist,
} from "@/lib/services/playlists";
import {
  deletePlaylistAction,
  revalidateProfileAction,
} from "@/lib/actions/playlists";
import { getDefaultCover } from "@/lib/playlist-covers";
import { playlistUrl } from "@/lib/playlistUrl";
import { playlistToText } from "@/lib/playlistText";
import type { PlaylistSpot, SearchResult } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Close } from "@/components/ui/icons/Close";
import { Lock } from "@/components/ui/icons/Lock";
import { Edit } from "@/components/ui/icons/Edit";
import { Overflow } from "@/components/ui/icons/Overflow";
import { Photo } from "@/components/ui/icons/Photo";
import { Spinner } from "@/components/ui/Spinner";
import { Share } from "@/components/ui/icons/Share";
import { Copy } from "@/components/ui/icons/Copy";
import { Check } from "@/components/ui/icons/Check";
import { CheckCircle } from "@/components/ui/icons/CheckCircle";
import { Trash } from "@/components/ui/icons/Trash";
import { World } from "@/components/ui/icons/World";
import { Sheet, ConfirmSheet } from "@/components/ui/Sheet";
import { snackbar, dismissSnackbar, dismissAllSnackbars } from "@/components/ui/Snackbar";
import { toast } from "@/components/ui/Toast";
import { Error as ErrorIcon } from "@/components/ui/icons/Error";
import type { SheetItem } from "@/components/ui/Sheet";
import SpotCard from "@/components/SpotCard";
import BookmarkButton from "@/components/BookmarkButton";
import { SpotSearchPanel } from "@/components/SpotSearchPanel";
import { DescriptionField } from "@/components/playlist-editor/DescriptionField";
import { EditableSpotCard } from "@/components/playlist-editor/EditableSpotCard";
import { pickHighlightPlaceholder } from "@/components/playlist-editor/highlightPlaceholders";
import { AddSpotSection } from "@/components/playlist-editor/AddSpotSection";
import { useCoverPhotoUpload } from "@/components/playlist-editor/useCoverPhotoUpload";
import { SlotRow } from "@/components/ui/SlotRow";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Asterisk } from "@/components/ui/icons/Asterisk";

interface Props {
  playlist: any;
  isOwner: boolean;
  fromNew?: boolean;
  onClose?: (pushTo?: string) => void;
  closeReady?: boolean;
}

/** A spot added via search but not yet persisted — notes are staged client-side. */
type PendingAdd = SearchResult & { notes?: string };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}


export default function PlaylistEditor({ playlist, isOwner, onClose, closeReady = true }: Props) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const signupSnackbarIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || user) return;

    function showSignupSnackbar() {
      signupSnackbarIdRef.current = snackbar({
        icon: null,
        message: "Love this list? Save spots on Here*",
        duration: 0,
        actionLabel: "Sign up",
        onAction: () => router.push("/signin"),
      });
    }

    const timer = setTimeout(showSignupSnackbar, 4000);

    // Sign in/up lives in a separate root layout, so leaving this page is a
    // full browser navigation. Coming back via the browser's back button can
    // restore this page from bfcache instead of remounting it, which would
    // otherwise leave the snackbar's one-shot mount effect never re-firing.
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) showSignupSnackbar();
    }
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [authLoading, user, router]);

  function closePlaylist(pushTo?: string) {
    if (signupSnackbarIdRef.current) dismissSnackbar(signupSnackbarIdRef.current);
    if (onClose) onClose(pushTo);
    else router.push(`/${playlist.profiles.username}`);
  }

  const [editMode, setEditMode] = useState(false);
  const [highlightPlaceholder, setHighlightPlaceholder] = useState(pickHighlightPlaceholder);

  // At the lg breakpoint, edit mode splits into a sticky cover column and a
  // right column that scrolls internally (see the `lg:overflow-y-auto`
  // column below) — so the outer page must not also scroll, or hovering the
  // sticky cover scrolls the whole document instead of doing nothing.
  useEffect(() => {
    if (!editMode) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    function applyLock() {
      document.body.style.overflow = mql.matches ? "hidden" : "unset";
    }
    applyLock();
    mql.addEventListener("change", applyLock);
    return () => {
      mql.removeEventListener("change", applyLock);
      document.body.style.overflow = "unset";
    };
  }, [editMode]);

  const [reorderMode, setReorderMode] = useState(false);
  const [isAddSpotOpen, setIsAddSpotOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>(
    playlist.cover_photo_url ?? getDefaultCover(playlist.city, playlist.name),
  );
  const [name, setName] = useState<string>(playlist.name ?? "");
  const lastNameRef = useRef<string>(playlist.name ?? "");
  const [description, setDescription] = useState<string>(
    playlist.description ?? "",
  );
  const [spots, setSpots] = useState<PlaylistSpot[]>(
    [...playlist.playlist_spots].sort(
      (a: PlaylistSpot, b: PlaylistSpot) =>
        (a.position ?? 0) - (b.position ?? 0),
    ),
  );
  const [isPublic, setIsPublic] = useState(playlist.is_public);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const overflowRef = useRef<HTMLButtonElement>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const { canShare, share } = useShare();

  // Edit mode staging
  const editStartRef = useRef<{
    name: string;
    description: string;
    coverUrl: string;
    spots: PlaylistSpot[];
  } | null>(null);
  const [stagedCoverFile, setStagedCoverFile] = useState<File | null>(null);
  const { coverInputRef, handleCoverSelect } = useCoverPhotoUpload((file) => {
    setStagedCoverFile(file);
    setCoverUrl(URL.createObjectURL(file));
  });
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const existingPlaceIds = new Set([
    ...spots.map((s) => s.spots.google_place_id),
    ...pendingAdds.map((p) => p.spot_id),
  ]);

  const hasEditChanges =
    editMode &&
    (name !== (editStartRef.current?.name ?? "") ||
      description !== (editStartRef.current?.description ?? "") ||
      stagedCoverFile !== null ||
      pendingAdds.length > 0 ||
      pendingRemoveIds.size > 0 ||
      !spots.every((s, i) => s.id === editStartRef.current?.spots[i]?.id) ||
      spots.some((s) => {
        const orig = editStartRef.current?.spots.find((o) => o.id === s.id);
        return (s.notes ?? "") !== (orig?.notes ?? "");
      }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spots.findIndex((s) => s.id === active.id);
    const newIndex = spots.findIndex((s) => s.id === over.id);
    setSpots(arrayMove(spots, oldIndex, newIndex));
  }

  function handleAddSpot(place: SearchResult) {
    if (pendingAdds.some((p) => p.spot_id === place.spot_id)) return;
    setPendingAdds((prev) => [...prev, place]);
    snackbar({
      icon: <CheckCircle />,
      message: `Added to “${name}”`,
      actionLabel: "Undo",
      onAction: () => handleRemovePendingAdd(place.spot_id),
    });
  }

  function handleRemovePendingAdd(spotId: string) {
    setPendingAdds((prev) => prev.filter((p) => p.spot_id !== spotId));
  }

  function handlePendingAddNotesChange(spotId: string, notes: string) {
    setPendingAdds((prev) =>
      prev.map((p) => (p.spot_id === spotId ? { ...p, notes } : p)),
    );
  }

  function handleRemoveSpot(playlistSpotId: string) {
    const removed = spots.find((s) => s.id === playlistSpotId);
    setPendingRemoveIds((prev) => new Set([...prev, playlistSpotId]));
    setSpots((prev) => prev.filter((s) => s.id !== playlistSpotId));
    snackbar({
      icon: <Trash />,
      message: `${removed?.spots.name ?? "Spot"} removed`,
      actionLabel: "Undo",
      onAction: () => {
        setPendingRemoveIds((prev) => {
          const next = new Set(prev);
          next.delete(playlistSpotId);
          return next;
        });
        if (removed) {
          setSpots((prev) => {
            const idx = removed.position ?? prev.length;
            const copy = [...prev];
            copy.splice(idx, 0, removed);
            return copy;
          });
        }
      },
    });
  }

  function handleNotesChange(spotId: string, notes: string) {
    setSpots((prev) =>
      prev.map((s) => (s.id === spotId ? { ...s, notes } : s)),
    );
  }

  function handleEnterEdit() {
    editStartRef.current = { name, description, coverUrl, spots: [...spots] };
    setPendingAdds([]);
    setPendingRemoveIds(new Set());
    setStagedCoverFile(null);
    setHighlightPlaceholder(pickHighlightPlaceholder());
    setEditMode(true);
  }

  function discardEdits() {
    if (editStartRef.current) {
      setName(editStartRef.current.name);
      setDescription(editStartRef.current.description);
      setCoverUrl(editStartRef.current.coverUrl);
      setSpots(editStartRef.current.spots);
    }
    setStagedCoverFile(null);
    setPendingAdds([]);
    setPendingRemoveIds(new Set());
    setEditMode(false);
    editStartRef.current = null;
  }

  function handleCancelEdit() {
    if (hasEditChanges) {
      setIsConfirmCancelOpen(true);
    } else {
      discardEdits();
    }
  }

  async function handleDone() {
    dismissAllSnackbars();
    setSaving(true);
    try {
      // Cover
      if (stagedCoverFile) {
        setUploadingCover(true);
        try {
          const url = await uploadPlaylistCover(
            playlist.id,
            user?.id ?? "",
            stagedCoverFile,
            editStartRef.current?.coverUrl ?? "",
          );
          setCoverUrl(url);
        } catch {
          toast({
            icon: <ErrorIcon />,
            message: "Failed to upload cover photo",
          });
          setStagedCoverFile(null);
          if (editStartRef.current) setCoverUrl(editStartRef.current.coverUrl);
        } finally {
          setUploadingCover(false);
        }
      }

      // Name
      const trimmedName = name.trim();
      if (!trimmedName) {
        setName(editStartRef.current?.name ?? "");
      } else {
        if (trimmedName !== name) setName(trimmedName);
        lastNameRef.current = trimmedName;
        if (trimmedName !== editStartRef.current?.name) {
          const newSlug = await updatePlaylistName(playlist.id, playlist.user_id, trimmedName);
          if (newSlug !== playlist.slug) {
            router.replace(
              playlistUrl(playlist.profiles.username, playlist.city, trimmedName, newSlug)
            );
          }
        }
      }

      // Description
      if (description !== editStartRef.current?.description) {
        await updatePlaylistDescription(playlist.id, description);
      }

      // Remove spots
      for (const id of pendingRemoveIds) {
        await removeSpotFromPlaylist(id);
      }

      // Add new spots
      let finalSpots = [...spots];
      for (const place of pendingAdds) {
        const spot = await upsertSpot({
          google_place_id: place.spot_id,
          name: place.name,
          address: place.address,
          photo_url: place.photo_url,
          rating: place.rating,
          types: place.types,
        });
        const ps = await addSpotToPlaylist(
          playlist.id,
          spot.id,
          finalSpots.length,
          user?.id ?? "",
        );
        finalSpots = [...finalSpots, { ...ps, spots: spot, notes: place.notes ?? null }];
      }

      // Reorder if anything changed
      const originalSpots = editStartRef.current?.spots ?? [];
      const reorderNeeded =
        pendingRemoveIds.size > 0 ||
        pendingAdds.length > 0 ||
        !finalSpots.every((s, i) => s.id === originalSpots[i]?.id);
      if (reorderNeeded) {
        await reorderPlaylistSpots(
          finalSpots.map((s, i) => ({ id: s.id, position: i })),
        );
      }
      setSpots(finalSpots);
      setPendingAdds([]);

      // Notes
      for (const s of finalSpots) {
        const orig = originalSpots.find((o) => o.id === s.id);
        if ((s.notes ?? "") !== (orig?.notes ?? "")) {
          await updateSpotNotes(s.id, s.notes ?? "");
        }
      }

      await touchPlaylist(playlist.id);
      await revalidateProfileAction(playlist.profiles.username);
      window.dispatchEvent(new Event("playlist-saved"));
      setSavedAt(Date.now());
      setEditMode(false);
      setPendingRemoveIds(new Set());
      setStagedCoverFile(null);
      editStartRef.current = null;
      router.refresh();
    } catch {
      toast({ icon: <ErrorIcon />, message: "Failed to save changes" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlaylist() {
    const username = playlist.profiles.username;
    const playlistId = playlist.id;

    // Delete right away rather than deferring it to a snackbar's "undo"
    // grace period: `/new`'s route group has its own root layout, so
    // leaving this page for the profile is a full navigation that tears
    // down any pending JS timers — a deferred delete would silently never
    // run, leaving the playlist undeleted until the tab happened to still
    // be open when the timer fired.
    try {
      await deletePlaylistAction(playlistId, username);
    } catch (err) {
      console.error("Error deleting playlist:", err);
      snackbar({
        icon: <ErrorIcon />,
        message: "Something went wrong. Please try again.",
      });
      return;
    }

    closePlaylist(`/${username}`);
  }

  return (
    <div className="w-full lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
      {/* Cover photo */}
      <div className="relative mb-4 lg:mb-0 lg:sticky lg:top-0 lg:h-[calc(100vh_-_2*var(--space-page-sm))]">
        <Card
          className="h-[30rem] lg:h-full"
          size="hero"
          image={coverUrl}
          city={playlist.city}
          name={name}
          onNameChange={
            isOwner
              ? (v) => {
                  setName(v);
                  if (v.trim()) lastNameRef.current = v;
                }
              : undefined
          }
          onNameBlur={
            isOwner
              ? (v) => {
                  const trimmed = v.trim();
                  if (!trimmed) {
                    setName(lastNameRef.current);
                    return;
                  }
                  if (trimmed !== v) setName(trimmed);
                  lastNameRef.current = trimmed;
                }
              : undefined
          }
          readOnlyName={!editMode}
          topLeft={
            editMode ? (
              <button
                onClick={handleCancelEdit}
                className="text-body-xs text-white cursor-pointer lg:hidden"
              >
                Cancel
              </button>
            ) : closeReady ? (
              <IconButton
                variant="overlay"
                icon={<Close />}
                label="Close"
                onClick={() => closePlaylist()}
              />
            ) : undefined
          }
          topCenter={
            editMode ? (
              <p className="text-body-sm-bold text-white lg:hidden">Edit playlist</p>
            ) : undefined
          }
          topRight={
            editMode ? (
              <button
                onClick={handleDone}
                disabled={saving}
                className="text-body-xs text-white cursor-pointer disabled:opacity-50 min-w-[3.5rem] text-right lg:hidden"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            ) : isOwner ? (
              <IconButton
                variant="overlay"
                icon={<Overflow orientation="horizontal" />}
                label="More options"
                ref={overflowRef}
                onClick={() => setIsSheetOpen((s) => !s)}
              />
            ) : (
              <div className="text-white flex items-center gap-2">
                <BookmarkButton playlistId={playlist.id} variant="overlay" />
                {canShare && (
                  <IconButton
                    variant="overlay"
                    icon={<Share />}
                    label="Share"
                    onClick={() =>
                      share(
                        `${window.location.origin}${playlistUrl(playlist.profiles.username, playlist.city, name, playlist.slug)}`,
                        playlistDocTitle(
                          playlist.city,
                          name,
                          playlist.profiles.username,
                        ),
                      )
                    }
                  />
                )}
              </div>
            )
          }
          bottomLeft={
            editMode ? undefined : (
              <Avatar
                size="sm"
                lgSize="md"
                src={playlist.profiles.avatar_url ?? undefined}
                username={playlist.profiles.username}
                href={`/${playlist.profiles.username}`}
              />
            )
          }
          bottomCenter={
            editMode ? (
              uploadingCover ? (
                <div className="py-1.5">
                  <Spinner />
                </div>
              ) : (
                <Button
                  variant="overlay"
                  size="sm"
                  leftIcon={<Photo />}
                  onClick={() => coverInputRef.current?.click()}
                >
                  Change cover photo
                </Button>
              )
            ) : undefined
          }
          bottomRight={
            editMode ? undefined : (
              <p className="text-brand text-body-xs">
                <span suppressHydrationWarning className="flex items-center justify-center gap-[0.125rem]">
                  Last updated{" "}
                  {savedAt !== null ? "now" : timeAgo(playlist.updated_at)}
                  {!isPublic && (
                    <>
                      <span style={{ marginLeft: "2px" }}>· </span>
                      <span className="inline-flex items-center gap-[0.125rem]">
                        <Lock className="size-4" /> Private
                      </span>
                    </>
                  )}
                </span>
              </p>
            )
          }
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={handleCoverSelect}
        />
      </div>

      {/* Right column */}
      <div className={editMode ? "lg:flex lg:flex-col lg:max-h-[calc(100vh_-_2*var(--space-page-sm))]" : undefined}>
        <div className={`${isAddSpotOpen ? "hidden" : ""} ${editMode ? "lg:flex-1 lg:overflow-y-auto" : ""}`}>
        {editMode && (
          <div className="hidden lg:block">
            <SlotRow
              className="mb-6"
              left={
                <Button variant="text" size="md" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              }
              center={
                <p className="text-body-sm-bold text-primary">
                  {reorderMode ? "Reorder spots" : "Edit playlist"}
                </p>
              }
              right={
                <Button variant="text" size="md" onClick={handleDone} disabled={saving}>
                  {saving ? "Saving…" : "Done"}
                </Button>
              }
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="w-full">
              {(editMode || description) && (
                <DescriptionField value={description} onChange={setDescription} readOnly={!editMode} />
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <p className="flex items-center text-body-md text-primary">
                  {spots.length + pendingAdds.length}{" "}
                  {spots.length + pendingAdds.length === 1 ? "spot" : "spots"}
                  <span>
                    <Asterisk className="size-[18px]" />
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Spots */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={spots.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 mb-6">
              {spots.length === 0 && pendingAdds.length === 0 && (
                <p className="text-gray-500 text-sm">No spots yet.</p>
              )}
              {spots.map((ps) =>
                editMode ? (
                  <EditableSpotCard
                    key={ps.id}
                    item={{ id: ps.id, spot: ps.spots, notes: ps.notes ?? undefined }}
                    reorderMode={reorderMode}
                    onRemove={handleRemoveSpot}
                    onNotesChange={handleNotesChange}
                    placeholder={highlightPlaceholder}
                  />
                ) : (
                  <SpotCard
                    key={ps.id}
                    spot={ps.spots}
                    subtitleText={ps.notes ?? ""}
                    bookmark={<BookmarkButton spot={ps.spots} variant="secondary" />}
                  />
                ),
              )}
              {/* Pending adds (not yet persisted) — no reorder, not in the sortable items list above */}
              {pendingAdds.map((place) => (
                <EditableSpotCard
                  key={place.spot_id}
                  item={{
                    id: place.spot_id,
                    spot: {
                      google_place_id: place.spot_id,
                      name: place.name,
                      address: place.address,
                      photo_url: place.photo_url,
                    },
                    notes: place.notes,
                  }}
                  reorderMode={false}
                  onRemove={handleRemovePendingAdd}
                  onNotesChange={handlePendingAddNotesChange}
                  placeholder={highlightPlaceholder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add a spot + Reorder — edit mode only */}
        {editMode && (
          <AddSpotSection
            spotCount={spots.length}
            reorderMode={reorderMode}
            onToggleReorder={() => setReorderMode((r) => !r)}
            onOpenSearch={() => setIsAddSpotOpen(true)}
          />
        )}
      </div>

      {editMode && (
        <SpotSearchPanel
          isOpen={isAddSpotOpen}
          onClose={() => {
            dismissAllSnackbars();
            setIsAddSpotOpen(false);
          }}
          city={playlist.city}
          cityId={playlist.city_id ?? undefined}
          addedPlaceIds={existingPlaceIds}
          onSelect={handleAddSpot}
        />
      )}
      </div>
      {/* end right column */}

      {isOwner && (
        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          anchorRef={overflowRef}
          align="end"
          title="Options"
          items={
            [
              ...(canShare
                ? [
                    {
                      label: "Share",
                      onClick: () =>
                        share(
                          `${window.location.origin}${playlistUrl(playlist.profiles.username, playlist.city, name, playlist.slug)}`,
                          playlistDocTitle(
                            playlist.city,
                            name,
                            playlist.profiles.username,
                          ),
                        ),
                      icon: <Share />,
                    },
                  ]
                : []),
              {
                label: "Copy as text",
                onClick: async () => {
                  await navigator.clipboard.writeText(playlistToText(playlist));
                  setIsSheetOpen(false);
                  toast({
                    icon: <Check focus />,
                    message: "Playlist copied to clipboard",
                  });
                },
                icon: <Copy />,
              },
              {
                label: "Edit",
                onClick: () => {
                  setIsSheetOpen(false);
                  handleEnterEdit();
                },
                icon: <Edit />,
              },
              {
                label: isPublic
                  ? "Make playlist private"
                  : "Make playlist public",
                onClick: async () => {
                  const next = !isPublic;
                  setIsPublic(next);
                  setIsSheetOpen(false);
                  await updatePlaylistVisibility(playlist.id, next);
                  revalidateProfileAction(playlist.profiles.username);
                  toast({
                    icon: next ? <World /> : <Lock />,
                    message: `"${name}" made ${next ? "public" : "private"}`,
                  });
                },
                icon: isPublic ? <Lock /> : <World />,
              },
              {
                label: "Delete playlist",
                onClick: () => setIsConfirmDeleteOpen(true),
                variant: "danger" as const,
                icon: <Trash />,
              },
            ] satisfies SheetItem[]
          }
        />
      )}

      <ConfirmSheet
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        items={[
          { label: "Never mind", onClick: () => {} },
          {
            label: "Yes, delete",
            onClick: handleDeletePlaylist,
            variant: "danger",
          },
        ]}
      />

      <ConfirmSheet
        isOpen={isConfirmCancelOpen}
        onClose={() => setIsConfirmCancelOpen(false)}
        items={[
          { label: "Keep editing", onClick: () => {} },
          {
            label: "Discard changes",
            onClick: () => {
              setIsConfirmCancelOpen(false);
              discardEdits();
            },
            variant: "danger",
          },
        ]}
      />
    </div>
  );
}
