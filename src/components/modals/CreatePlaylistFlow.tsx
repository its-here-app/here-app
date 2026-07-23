"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { BottomPanel } from "@/components/ui/BottomPanel";
import { CityAutocompleteInput } from "@/components/ui/inputs/CityAutocompleteInput";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { snackbar } from "@/components/ui/Snackbar";
import { Add } from "@/components/ui/icons/Add";
import { ArrowLeft } from "@/components/ui/icons/ArrowLeft";
import { CheckCircle } from "@/components/ui/icons/CheckCircle";
import { Error } from "@/components/ui/icons/Error";
import { Lock } from "@/components/ui/icons/Lock";
import { Photo } from "@/components/ui/icons/Photo";
import { Trash } from "@/components/ui/icons/Trash";
import { World } from "@/components/ui/icons/World";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { SlotRow } from "@/components/ui/SlotRow";
import { Asterisk } from "@/components/ui/icons/Asterisk";
import { SpotSearchPanel } from "@/components/SpotSearchPanel";
import { DescriptionField } from "@/components/playlist-editor/DescriptionField";
import { EditableSpotCard, type EditableSpotItem } from "@/components/playlist-editor/EditableSpotCard";
import { AddSpotSection } from "@/components/playlist-editor/AddSpotSection";
import { useCoverPhotoUpload } from "@/components/playlist-editor/useCoverPhotoUpload";
import { ListInput } from "@/components/ui/inputs";
import { getDefaultCover } from "@/lib/playlist-covers";
import { formatCityDisplay } from "@/lib/cityDisplay";
import { parseSpotLines } from "@/lib/parseSpotLines";
import { resolveSpot, upsertSpot, uploadPlaylistCover } from "@/lib/services/playlists";
import { getProfile } from "@/lib/services/users";
import { getCityIdByGooglePlaceId } from "@/lib/services/cities";
import { randomPlaylistName } from "@/lib/playlistNames";
import { createPlaylistAction } from "@/lib/actions/playlists";
import { upsertCityAction } from "@/lib/actions/cities";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { DraftSpot, SearchResult } from "@/types";

// ─── Imperative trigger ───────────────────────────────────────────────────────

export interface InitialCity {
  google_place_id: string;
  display_name: string;
  is_primary?: boolean;
}

type OpenListener = (initialCity?: InitialCity) => void;
const listeners: OpenListener[] = [];

/**
 * Opens the create-playlist flow. Pass `initialCity` when the city is
 * already known from context (e.g. the home page's city filter) to skip
 * straight past the "Which city are you making a playlist for?" step.
 */
export function openCreatePlaylist(initialCity?: InitialCity) {
  listeners.forEach((fn) => fn(initialCity));
}

// ─── Shared form body ────────────────────────────────────────────────────────

const SPOTS_PLACEHOLDER = `Start by pasting an existing list of spots here,\nand we will add them to your playlist for you.\n\nFor example\n\n  · Melody, Cute bungalow wine bar with rotating chefs.\n  · Sqirl, Cutest small brunch + lunch place with house jam.\n  · Salazar, Mexican cute outdoor spot with vibes.\n  · 123 Farm, Lavender-themed foods, crafts, and petting zoo.`;

const SPOTS_PLACEHOLDER_MOBILE = `Paste an existing list of spots with highlights and notes. We can automatically add them to your playlist for you!`;

function PlaylistFormBody({
  description,
  onDescriptionChange,
  spotsInput,
  onSpotsInputChange,
  imported,
  foundSpots,
  onImport,
  onOpenSearch,
  onRemoveFoundSpot,
  onFoundSpotNotesChange,
  reorderMode,
  onToggleReorder,
  onReorder,
  sensors,
  spotsHeightClassName,
  spotsPlaceholder = SPOTS_PLACEHOLDER,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  spotsInput: string;
  onSpotsInputChange: (v: string) => void;
  imported: boolean;
  foundSpots: DraftSpot[];
  onImport: () => void;
  onOpenSearch: () => void;
  onRemoveFoundSpot: (placeId: string) => void;
  onFoundSpotNotesChange: (placeId: string, notes: string) => void;
  reorderMode: boolean;
  onToggleReorder: () => void;
  onReorder: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
  spotsHeightClassName?: string;
  spotsPlaceholder?: string;
}) {
  const items: EditableSpotItem[] = foundSpots.map((spot) => ({
    id: spot.google_place_id,
    spot,
    notes: spot.notes,
  }));

  return (
    <>
      <DescriptionField value={description} onChange={onDescriptionChange} />

      {/* Pre-import: spots textarea */}
      {!imported && (
        <div className="flex-1 flex flex-col min-h-0 mb-3">
          <ListInput
            className="flex-1 min-h-0"
            heightClassName={spotsHeightClassName}
            value={spotsInput}
            onChange={onSpotsInputChange}
            placeholder={spotsPlaceholder}
          />
        </div>
      )}

      {/* Spot list */}
      {foundSpots.length > 0 && (
        <>
          {imported && (
            <p className="flex items-center gap-1 text-body-sm text-primary mb-3">
              {foundSpots.length} spot{foundSpots.length !== 1 ? "s" : ""}
              <Asterisk className="size-[18px]" />
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <EditableSpotCard
                    key={item.id}
                    item={item}
                    reorderMode={reorderMode}
                    onRemove={onRemoveFoundSpot}
                    onNotesChange={onFoundSpotNotesChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Bottom action */}
      <div className={imported ? "pb-[var(--space-page-sm)]" : undefined}>
        <AddSpotSection
          spotCount={foundSpots.length}
          reorderMode={reorderMode}
          onToggleReorder={onToggleReorder}
          onOpenSearch={onOpenSearch}
          showImport={!imported && spotsInput.trim().length > 0}
          onImport={onImport}
        />
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePlaylistFlow() {
  const { user } = useAuth();
  const router = useRouter();

  // UI state
  const [panelOpen, setPanelOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayClosing, setOverlayClosing] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [missingPanelOpen, setMissingPanelOpen] = useState(false);

  // Form state
  const [city, setCity] = useState("");
  const [selectedCity, setSelectedCity] = useState<{
    google_place_id: string;
    display_name: string;
    is_primary?: boolean;
  } | null>(null);
  const [cityId, setCityId] = useState<string | undefined>(undefined);
  // Hides the state/country suffix for primary cities ("Portland, OR" ->
  // "Portland"), matching how city names render elsewhere in the app.
  const displayCity = formatCityDisplay(city, selectedCity?.is_primary);

  // Read-only lookup so popular spots can be shown for a city that's already
  // in our DB — doesn't upsert, so brand-new cities just show no suggestions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = selectedCity
        ? await getCityIdByGooglePlaceId(selectedCity.google_place_id)
        : null;
      if (!cancelled) setCityId(id ?? undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  const [draftName, setDraftName] = useState("");
  const defaultNameRef = useRef("");
  const lastNameRef = useRef("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [spotsInput, setSpotsInput] = useState("");
  const [foundSpots, setFoundSpots] = useState<DraftSpot[]>([]);
  const [unfoundSpots, setUnfoundSpots] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [imported, setImported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spotSearchOpen, setSpotSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => {
      setProfileUsername(p?.username ?? null);
      setProfileAvatarUrl(p?.avatar_url ?? "");
    });
  }, [user]);

  const addedPlaceIds = useMemo(
    () => new Set(foundSpots.map((s) => s.google_place_id)),
    [foundSpots]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFoundSpots((prev) => {
      const oldIndex = prev.findIndex((s) => s.google_place_id === active.id);
      const newIndex = prev.findIndex((s) => s.google_place_id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  // Cover state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [defaultCover, setDefaultCover] = useState("");
  // Tracks the "city|name" pair the current defaultCover was computed for, so
  // the debounced effect below doesn't re-roll a fresh random cover for inputs
  // that were already just used (e.g. by handleCreate's synchronous pick).
  const lastCoverKeyRef = useRef<string | null>(null);
  const { coverInputRef, handleCoverSelect: handleCoverChange } = useCoverPhotoUpload((file) => {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  });

  // Recompute the default cover only after the user pauses typing, so the
  // image doesn't flicker on every keystroke (since getDefaultCover is random).
  // Skip while the overlay isn't open yet — city changes during the city-picker
  // step (before draftName is set) would otherwise pick an early cover that
  // immediately gets replaced once handleCreate sets the real draftName.
  useEffect(() => {
    if (!overlayOpen) return;
    const key = `${city}|${draftName}`;
    const t = setTimeout(() => {
      if (lastCoverKeyRef.current === key) return;
      lastCoverKeyRef.current = key;
      setDefaultCover(getDefaultCover(city, draftName));
    }, 400);
    return () => clearTimeout(t);
  }, [overlayOpen, city, draftName]);

  // Listen for imperative open calls. When an initialCity is provided (e.g.
  // from the home page's city filter), pre-fill the city step instead of
  // making the user pick it again.
  useEffect(() => {
    const listener: OpenListener = (initialCity) => {
      if (initialCity) {
        setCity(initialCity.display_name);
        setSelectedCity(initialCity);
      }
      setPanelOpen(true);
    };
    listeners.push(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  // Escape key: close the spot search panel if open, otherwise open cancel confirmation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (spotSearchOpen) setSpotSearchOpen(false);
      else setConfirmCancelOpen(true);
    }
    if (overlayOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [overlayOpen, spotSearchOpen]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resetState() {
    setCity("");
    setSelectedCity(null);
    setDraftName("");
    setDescription("");
    setIsPublic(false);
    setSpotsInput("");
    setFoundSpots([]);
    setUnfoundSpots([]);
    setImporting(false);
    setImportStatus("");
    setImported(false);
    setSaving(false);
    setSpotSearchOpen(false);
    setShareOpen(false);
    setCoverFile(null);
    setCoverPreview("");
  }

  function dismissOverlay(then?: () => void) {
    setOverlayClosing(true);
    document.body.style.overflow = "";
    setTimeout(() => {
      setOverlayOpen(false);
      setOverlayClosing(false);
      then?.();
    }, 250);
  }

  function closePanel() {
    setPanelOpen(false);
    setCity("");
    setSelectedCity(null);
  }

  // ── Step 1: Create ─────────────────────────────────────────────────────────

  function handleCreate() {
    const name = randomPlaylistName();
    defaultNameRef.current = name;
    lastNameRef.current = name;
    setDraftName(name);
    lastCoverKeyRef.current = `${city}|${name}`;
    setDefaultCover(getDefaultCover(city, name));
    setPanelOpen(false);
    setOverlayOpen(true);
    document.body.style.overflow = "hidden";
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!city) return;
    setImporting(true);
    setImportStatus("importing your spots...");

    const parsed = parseSpotLines(spotsInput);

    const foundTemp: DraftSpot[] = [];
    const unfoundTemp: string[] = [];
    const total = parsed.length;

    for (let idx = 0; idx < parsed.length; idx++) {
      const { name: spotName, notes } = parsed[idx];

      // Update status at progress milestones
      const progress = idx / total;
      if (progress >= 0.25 && progress < 0.5) setImportStatus("finding images...");
      else if (progress >= 0.5 && progress < 0.75) setImportStatus("adding your notes...");
      else if (progress >= 0.75) setImportStatus("organizing your playlist...");

      try {
        const match = await resolveSpot(spotName, city);
        if (match) {
          await upsertSpot({
            google_place_id: match.spot_id,
            name: match.name,
            address: match.address,
            photo_url: match.photo_url,
            rating: match.rating,
            types: match.types,
          });
          foundTemp.push({
            google_place_id: match.spot_id,
            name: match.name,
            address: match.address,
            photo_url: match.photo_url,
            rating: match.rating,
            types: match.types,
            notes,
          });
        } else {
          unfoundTemp.push(spotName);
        }
      } catch {
        unfoundTemp.push(spotName);
      }
    }

    setFoundSpots((prev) => {
      // Duplicates keep their existing entry, but pick up notes from the
      // import line if the existing entry (e.g. added via search) had none.
      const merged = prev.map((p) => {
        const dup = foundTemp.find((s) => s.google_place_id === p.google_place_id);
        return dup?.notes && !p.notes ? { ...p, notes: dup.notes } : p;
      });
      const newOnes = foundTemp.filter(
        (spot) => !prev.some((p) => p.google_place_id === spot.google_place_id),
      );
      return [...merged, ...newOnes];
    });
    setUnfoundSpots(unfoundTemp);
    setImporting(false);
    setImportStatus("");
    setImported(true);

    if (unfoundTemp.length > 0) {
      snackbar({
        icon: <Error />,
        message: `${unfoundTemp.length} missing spot${unfoundTemp.length === 1 ? "" : "s"}`,
        actionLabel: "See more",
        onAction: () => setMissingPanelOpen(true),
      });
    }
  }

  // "Continue" on the pre-import step: runs the import (combining the pasted
  // list with any manually-added spots) if there's anything to combine,
  // otherwise there's nothing to import and it just creates an empty playlist.
  function handleContinue() {
    if (!spotsInput.trim() && foundSpots.length === 0) {
      setShareOpen(true);
    } else {
      handleImport();
    }
  }

  function handleAddSpotFromSearch(result: SearchResult) {
    const already = foundSpots.some((s) => s.google_place_id === result.spot_id);
    if (already) return;
    setFoundSpots((prev) => [
      ...prev,
      {
        google_place_id: result.spot_id,
        name: result.name,
        address: result.address,
        photo_url: result.photo_url,
        rating: result.rating,
        types: result.types,
      },
    ]);
    snackbar({
      icon: <CheckCircle />,
      message: `Added to “${draftName}”`,
      actionLabel: "Undo",
      onAction: () =>
        setFoundSpots((prev) => prev.filter((s) => s.google_place_id !== result.spot_id)),
    });
  }

  function handleRemoveFoundSpot(placeId: string) {
    const removed = foundSpots.find((s) => s.google_place_id === placeId);
    setFoundSpots((prev) => prev.filter((s) => s.google_place_id !== placeId));
    if (removed) {
      snackbar({
        icon: <Trash />,
        message: `${removed.name} removed`,
        actionLabel: "Undo",
        onAction: () => setFoundSpots((prev) => [...prev, removed]),
      });
    }
  }

  function handleFoundSpotNotesChange(placeId: string, notes: string) {
    setFoundSpots((prev) =>
      prev.map((s) => (s.google_place_id === placeId ? { ...s, notes } : s)),
    );
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    try {
      let cityId: string | undefined;
      if (selectedCity) {
        cityId = await upsertCityAction({
          google_place_id: selectedCity.google_place_id,
          display_name: selectedCity.display_name,
          is_primary: selectedCity.is_primary,
        });
      }

      const result = await createPlaylistAction({
        name: draftName.trim(),
        city,
        city_id: cityId,
        description,
        is_public: isPublic,
        spots: foundSpots,
      });

      if (coverFile) {
        await uploadPlaylistCover(result.id, user.id, coverFile);
      }

      dismissOverlay(() => {
        resetState();
        router.refresh();
      });
    } catch (err) {
      console.error("Error creating playlist:", err);
      setSaving(false);
      snackbar({
        icon: <Error />,
        message: "Something went wrong. Please try again.",
      });
    }
  }

  // ── Discard ────────────────────────────────────────────────────────────────

  function handleDiscard() {
    setConfirmCancelOpen(false);
    dismissOverlay(resetState);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Step 1 — City BottomPanel */}
      <BottomPanel
        isOpen={panelOpen}
        onClose={closePanel}
        header="Create a playlist"
        subheader="Which city are you making a playlist for?"
        mobileHeight="tall"
        centerBody
        desktopVariant="full-page"
        footer={
          <Button
            variant="filled"
            size="md"
            darkTheme
            softDisabled
            disabled={!selectedCity}
            onClick={handleCreate}
            className="w-full"
          >
            Create
          </Button>
        }
        desktopFooter={
          <Button
            variant="filled"
            size="lg"
            darkTheme
            softDisabled
            disabled={!selectedCity}
            onClick={handleCreate}
          >
            Create
          </Button>
        }
      >
        <CityAutocompleteInput
          variant="ghost"
          value={displayCity}
          onSelect={(c) => {
            setCity(c.display_name);
            setSelectedCity(c);
          }}
          onChange={(val) => {
            setCity(val);
            setSelectedCity(null);
          }}
          placeholder="New York"
          autoFocus
          className="lg:-mt-[1.5rem]"
        />
      </BottomPanel>

      {/* Importing overlay — full-screen dark with status */}
      {importing && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center lg:hidden">
          <p className="text-display-crimson-3 text-white">{importStatus}</p>
        </div>
      )}

      {/* Steps 3–5 — Create Overlay */}
      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-white overflow-y-auto p-[var(--space-page-sm)] lg:pb-0"
          style={{
            animation: `${overlayClosing ? "fadeOut" : "fadeIn"} 250ms ease forwards`,
          }}
        >
          <div
            className="flex flex-col h-full lg:block"
            style={{ ["--col-w" as string]: "calc((100vw - 2*var(--space-page-sm) - 1.5rem) / 2)" }}
          >
            {/* Left — Card. Desktop: position:fixed (not sticky) so it's pinned to the
                viewport regardless of how tall the right column's content is — sticky's
                containing block is the row it shares with the right column, so it would
                detach/scroll once that row's height caught up to the right column's. */}
            <div className={`relative shrink-0 mb-4 lg:mb-0 lg:fixed lg:top-[var(--space-page-sm)] lg:left-[var(--space-page-sm)] lg:w-[var(--col-w)] lg:h-[calc(100vh-2*var(--space-page-sm))] ${!imported ? "lg:block" : ""}`}>
              <Card
                className="h-[30rem] lg:h-full"
                size="hero"
                image={coverPreview || defaultCover}
                city={displayCity}
                name={draftName}
                onNameChange={(v) => { setDraftName(v); if (v.trim()) lastNameRef.current = v; }}
                onNameBlur={(v) => { if (!v.trim()) setDraftName(lastNameRef.current); }}
                topLeft={
                  <button
                    onClick={() => setConfirmCancelOpen(true)}
                    className="text-body-xs text-white cursor-pointer lg:hidden"
                  >
                    Cancel
                  </button>
                }
                topCenter={
                  <p className="text-body-sm-bold text-white lg:hidden">Create playlist</p>
                }
                topRight={
                  <button
                    onClick={imported ? () => setShareOpen(true) : handleContinue}
                    className="text-body-xs text-white cursor-pointer lg:hidden"
                  >
                    {imported ? "Done" : "Continue"}
                  </button>
                }
                bottomCenter={
                  <Button
                    variant="overlay"
                    size="sm"
                    leftIcon={<Photo />}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Change cover photo
                  </Button>
                }
              />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="sr-only"
                onChange={handleCoverChange}
              />
            </div>

            {/* Right — Form or Search (desktop). lg:ml matches the fixed left column's
                width + gap, since it's no longer a grid sibling that reserves that space. */}
            <div className={`relative flex-1 min-h-0 flex flex-col lg:ml-[calc(var(--col-w)+1.5rem)] ${!imported ? "lg:h-[calc(100vh-2*var(--space-page-sm))]" : ""}`}>
              {/* Desktop: importing overlay, scoped to this column (mobile uses the full-screen one above).
                  Positioned against this non-scrolling wrapper (not the scrollable box below) so its
                  inset-0 always matches the full rounded box, top and bottom. */}
              {importing && (
                <div className="hidden lg:flex absolute inset-0 z-10 bg-black rounded-lg items-center justify-center">
                  <p className="text-display-crimson-3 text-white">{importStatus}</p>
                </div>
              )}

              <div className="relative flex-1 min-h-0 flex flex-col overflow-y-auto">
                {/* Desktop: normal form, CSS-hidden (not unmounted) while search is open */}
                <div className={spotSearchOpen ? "hidden" : "hidden lg:flex lg:flex-col lg:h-full"}>
                  <SlotRow
                    className="mb-6"
                    left={
                      <Button variant="text" size="md" onClick={() => setConfirmCancelOpen(true)}>
                        Cancel
                      </Button>
                    }
                    center={<p className="text-body-sm-bold text-primary">Create playlist</p>}
                    right={
                      <Button
                        variant="text"
                        size="md"
                        onClick={imported ? () => setShareOpen(true) : handleContinue}
                      >
                        {imported ? "Done" : "Continue"}
                      </Button>
                    }
                  />

                  <PlaylistFormBody
                    description={description}
                    onDescriptionChange={setDescription}
                    spotsInput={spotsInput}
                    onSpotsInputChange={setSpotsInput}
                    imported={imported}
                    foundSpots={foundSpots}
                    onImport={handleImport}
                    onOpenSearch={() => setSpotSearchOpen(true)}
                    onRemoveFoundSpot={handleRemoveFoundSpot}
                    onFoundSpotNotesChange={handleFoundSpotNotesChange}
                    reorderMode={reorderMode}
                    onToggleReorder={() => setReorderMode((r) => !r)}
                    onReorder={handleReorder}
                    sensors={sensors}
                    spotsHeightClassName="h-full min-h-0"
                  />
                </div>

                <SpotSearchPanel
                  isOpen={spotSearchOpen}
                  onClose={() => {
                    setSpotSearchOpen(false);
                    if (foundSpots.length > 0) setImported(true);
                  }}
                  city={city}
                  cityId={cityId}
                  addedPlaceIds={addedPlaceIds}
                  onSelect={handleAddSpotFromSearch}
                />

                {/* Mobile — always show form (search is a separate overlay) */}
                <div className="lg:hidden flex-1 min-h-0 flex flex-col">
                  <PlaylistFormBody
                    description={description}
                    onDescriptionChange={setDescription}
                    spotsInput={spotsInput}
                    onSpotsInputChange={setSpotsInput}
                    imported={imported}
                    foundSpots={foundSpots}
                    onImport={handleImport}
                    onOpenSearch={() => setSpotSearchOpen(true)}
                    onRemoveFoundSpot={handleRemoveFoundSpot}
                    onFoundSpotNotesChange={handleFoundSpotNotesChange}
                    reorderMode={reorderMode}
                    onToggleReorder={() => setReorderMode((r) => !r)}
                    onReorder={handleReorder}
                    sensors={sensors}
                    spotsHeightClassName="h-full min-h-0"
                    spotsPlaceholder={SPOTS_PLACEHOLDER_MOBILE}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      <ConfirmSheet
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        items={[
          { label: "Keep editing", onClick: () => {} },
          { label: "Discard", onClick: handleDiscard, variant: "danger" },
        ]}
      />

      {/* Share / Publish page */}
      {shareOpen && (
        <div className="fixed inset-0 z-[70] bg-white overflow-y-auto flex flex-col">
          {/* Header */}
          <SlotRow
            className="p-[var(--space-page-sm)] lg:p-[var(--space-page-md)] shrink-0"
            left={
              <IconButton
                variant="ghost"
                icon={<ArrowLeft />}
                label="Back"
                onClick={() => setShareOpen(false)}
              />
            }
            center={<p className="text-body-sm-bold text-primary">Share</p>}
          />

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-[var(--space-page-sm)] lg:px-[var(--space-page-md)]">
            {/* Card preview */}
            <div className="w-[clamp(15rem,11rem+17vw,22rem)]">
              <Card
                size="md"
                image={coverPreview || defaultCover}
                city={displayCity}
                name={draftName}
                bottomLeft={
                  <Avatar
                    size="sm"
                    src={profileAvatarUrl}
                    username={profileUsername ?? undefined}
                    href={profileUsername ? `/${profileUsername}` : undefined}
                  />
                }
                bottomRight={
                  <p className="flex items-center gap-0 text-body-xs text-brand">
                    <Asterisk className="size-[18px]" />
                    {foundSpots.length}
                  </p>
                }
              />
            </div>

            {/* Public toggle */}
            <button
              onClick={() => setIsPublic((p) => !p)}
              className="flex items-center gap-1 mt-6 cursor-pointer text-bubble"
            >
              {isPublic ? <World className="size-5" /> : <Lock className="size-5" />}
              <span className="text-body-sm text-bubble">
                {isPublic ? "Public" : "Private"}
              </span>
            </button>
          </div>

          {/* Share button */}
          <div className="p-[var(--space-page-sm)] lg:p-[var(--space-page-md)] lg:flex lg:justify-center shrink-0">
            <Button
              variant="filled"
              size="lg"
              onClick={handleSave}
              disabled={saving}
              className="w-full lg:w-[320px]"
            >
              {saving ? "Saving…" : "Share"}
            </Button>
          </div>
        </div>
      )}

      {/* Missing spots BottomPanel */}
      <BottomPanel
        isOpen={missingPanelOpen}
        onClose={() => setMissingPanelOpen(false)}
        header="Missing spots"
        desktopVariant="floating"
      >
        <div className="space-y-3">
          <p className="text-body-xs text-tertiary">
            We couldn&apos;t find a few of the spots
          </p>
          <ul className="text-primary text-body-sm list-disc pl-4">
            {unfoundSpots.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <Button
            variant="tonal"
            size="md"
            leftIcon={<Add className="size-5" />}
            className="w-full"
            onClick={() => {
              setMissingPanelOpen(false);
              setSpotSearchOpen(true);
            }}
          >
            Add manually
          </Button>
        </div>
      </BottomPanel>
    </>
  );
}
