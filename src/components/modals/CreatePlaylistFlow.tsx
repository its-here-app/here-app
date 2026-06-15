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
import { Error } from "@/components/ui/icons/Error";
import { Photo } from "@/components/ui/icons/Photo";
import { PlaylistCard } from "@/components/PlaylistCard";
import SpotCard from "@/components/SpotCard";
import SpotSearchInput from "@/components/SpotSearchInput";
import { getDefaultCover } from "@/lib/playlist-covers";
import { resolveSpot, upsertSpot, uploadPlaylistCover } from "@/lib/services/playlists";
import { randomPlaylistName } from "@/lib/playlistNames";
import { createPlaylistAction } from "@/lib/actions/playlists";
import { upsertCityAction } from "@/lib/actions/cities";
import type { DraftSpot, SearchResult } from "@/types";

// ─── Imperative trigger ───────────────────────────────────────────────────────

type OpenListener = () => void;
const listeners: OpenListener[] = [];

export function openCreatePlaylist() {
  listeners.forEach((fn) => fn());
}

// ─── Description field ───────────────────────────────────────────────────────

function DescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialMount = useRef(true);

  useEffect(() => {
    if (editing && !initialMount.current) {
      inputRef.current?.focus();
    }
    initialMount.current = false;
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mb-4 text-left w-full"
      >
        <p className="text-body-sm text-gray-600">
          {value || "What does this playlist capture? (optional)"}
        </p>
        {!value && (
          <p className="text-body-xs text-gray-600 mt-0.5">
            ie. favorite spots that is nostalgic to me
          </p>
        )}
      </button>
    );
  }

  return (
    <div className="mb-4">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={3}
        placeholder="What does this playlist capture?"
        className="w-full px-4 py-3 border border-subtle rounded-2xl text-body-sm text-primary bg-transparent resize-none outline-none placeholder:text-tertiary focus:border-primary transition-colors"
      />
    </div>
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

  const addedPlaceIds = useMemo(
    () => new Set(foundSpots.map((s) => s.google_place_id)),
    [foundSpots]
  );

  // Cover state
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [defaultCover, setDefaultCover] = useState("");

  // Recompute the default cover only after the user pauses typing, so the
  // image doesn't flicker on every keystroke (since getDefaultCover is random).
  useEffect(() => {
    const t = setTimeout(() => {
      setDefaultCover(getDefaultCover(city, draftName));
    }, 400);
    return () => clearTimeout(t);
  }, [city, draftName]);

  // Listen for imperative open calls
  useEffect(() => {
    const listener: OpenListener = () => setPanelOpen(true);
    listeners.push(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  // Escape key: open cancel confirmation when overlay is open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmCancelOpen(true);
    }
    if (overlayOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [overlayOpen]);

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

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
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
    setPanelOpen(false);
    setOverlayOpen(true);
    document.body.style.overflow = "hidden";
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!city) return;
    setImporting(true);
    setImportStatus("importing your spots...");

    const lines = spotsInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const foundTemp: DraftSpot[] = [];
    const unfoundTemp: string[] = [];
    const total = lines.length;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const commaIdx = line.indexOf(",");
      const spotName = commaIdx === -1 ? line.trim() : line.slice(0, commaIdx).trim();
      const notes = commaIdx === -1 ? undefined : line.slice(commaIdx + 1).trim() || undefined;

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

    setFoundSpots(foundTemp);
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
          value={city}
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
          <p className="text-body-sm text-white/60 italic">{importStatus}</p>
        </div>
      )}

      {/* Steps 3–5 — Create Overlay */}
      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-white overflow-y-auto p-[var(--space-page-sm)] lg:p-[var(--space-page-md)] lg:pb-0"
          style={{
            animation: `${overlayClosing ? "fadeOut" : "fadeIn"} 250ms ease forwards`,
          }}
        >
          <div className="w-full lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            {/* Left — PlaylistCard */}
            <div className={`relative mb-4 lg:mb-0 lg:sticky lg:top-0 lg:h-[calc(100vh-2*var(--space-page-md))] ${!imported ? "lg:block" : ""}`}>
              <PlaylistCard
                className={`${imported ? "h-[30rem]" : "h-[10rem]"} lg:h-full`}
                size="hero"
                image={coverPreview || defaultCover}
                city={city}
                name={draftName}
                onNameChange={(v) => { setDraftName(v); if (v.trim()) lastNameRef.current = v; }}
                onNameBlur={(v) => { if (!v.trim()) setDraftName(lastNameRef.current); }}
                topLeft={
                  imported ? (
                    <button
                      onClick={() => setConfirmCancelOpen(true)}
                      className="text-body-xs text-white cursor-pointer lg:hidden"
                    >
                      Cancel
                    </button>
                  ) : undefined
                }
                topCenter={
                  imported ? (
                    <p className="text-body-sm-bold text-white lg:hidden">Edit playlist</p>
                  ) : undefined
                }
                topRight={
                  imported ? (
                    <button
                      onClick={() => setShareOpen(true)}
                      className="text-body-xs text-white cursor-pointer lg:hidden"
                    >
                      Done
                    </button>
                  ) : undefined
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
                accept="image/*"
                className="sr-only"
                onChange={handleCoverChange}
              />
            </div>

            {/* Right — Form or Search (desktop) */}
            <div className="pb-[var(--space-page-sm)] lg:flex lg:flex-col lg:h-[calc(100vh-2*var(--space-page-md))]">
              {/* Desktop: spot search replaces form */}
              {spotSearchOpen ? (
                <div className="hidden lg:flex lg:flex-col lg:h-full">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() => setSpotSearchOpen(false)}
                      className="text-body-sm text-secondary cursor-pointer"
                    >
                      Cancel
                    </button>
                    <p className="text-body-sm-bold text-primary">Add spots</p>
                    <button
                      onClick={() => setSpotSearchOpen(false)}
                      className="text-body-sm text-secondary cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <SpotSearchInput
                      placeholder="Search"
                      city={city}
                      addedPlaceIds={addedPlaceIds}
                      onSelect={handleAddSpotFromSearch}
                    />
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex lg:flex-col lg:h-full">
                  {/* Desktop header */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() => setConfirmCancelOpen(true)}
                      className="text-body-sm text-secondary cursor-pointer"
                    >
                      Cancel
                    </button>
                    <p className="text-body-sm-bold text-primary">Edit playlist</p>
                    <button
                      onClick={() => setShareOpen(true)}
                      className="text-body-sm text-secondary cursor-pointer"
                    >
                      Done
                    </button>
                  </div>

                  {/* Description */}
                  <DescriptionField
                    value={description}
                    onChange={setDescription}
                  />

                  {/* Pre-import: spots textarea */}
                  {!imported && (
                    <div className="flex-1 flex flex-col min-h-0 mb-4">
                      <textarea
                        value={spotsInput}
                        onChange={(e) => setSpotsInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && spotsInput.trim()) {
                            e.preventDefault();
                            handleImport();
                          }
                        }}
                        placeholder={`Start by pasting an existing list of spots here,\nand we will add them to your playlist for you.\n\nFor example\n\n  · Melody, Cute bungalow wine bar with rotating chefs.\n  · Sqirl, Cutest small brunch + lunch place with house jam.\n  · Salazar, Mexican cute outdoor spot with vibes.\n  · 123 Farm, Lavender-themed foods, crafts, and petting zoo.`}
                        className="flex-1 min-h-0 w-full px-4 py-3 border border-subtle rounded-2xl text-body-sm text-primary bg-transparent resize-none outline-none placeholder:text-tertiary focus:border-primary transition-colors"
                      />
                    </div>
                  )}

                  {/* Post-import: spot list */}
                  {imported && (
                    <>
                      {foundSpots.length > 0 && (
                        <p className="text-body-sm text-primary mb-3">
                          {foundSpots.length} spot{foundSpots.length !== 1 ? "s" : ""} ✦
                        </p>
                      )}
                      <div className="space-y-3 mb-4">
                        {foundSpots.map((spot) => (
                          <SpotCard key={spot.google_place_id} spot={spot} />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Spots added individually */}
                  {!imported && foundSpots.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {foundSpots.map((spot) => (
                        <SpotCard key={spot.google_place_id} spot={spot} />
                      ))}
                    </div>
                  )}

                  {/* Bottom action */}
                  {imported || foundSpots.length > 0 ? (
                    <Button
                      variant="outline"
                      size="md"
                      leftIcon={<Add className="size-5" />}
                      className="w-full"
                      onClick={() => setSpotSearchOpen(true)}
                    >
                      Add a spot
                    </Button>
                  ) : spotsInput.trim() ? (
                    <Button
                      variant="outline"
                      size="md"
                      className="w-full"
                      onClick={handleImport}
                      disabled={importing}
                    >
                      {importing ? "Importing…" : "Import"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="md"
                      leftIcon={<Add className="size-5" />}
                      className="w-full"
                      onClick={() => setSpotSearchOpen(true)}
                    >
                      Add a spot
                    </Button>
                  )}
                </div>
              )}

              {/* Mobile — always show form (search is a BottomPanel) */}
              <div className="lg:hidden">
                {/* Description */}
                <DescriptionField
                  value={description}
                  onChange={setDescription}
                />

                {/* Pre-import: spots textarea */}
                {!imported && (
                  <div className="flex-1 flex flex-col min-h-0 mb-4">
                    <textarea
                      value={spotsInput}
                      onChange={(e) => setSpotsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && spotsInput.trim()) {
                          e.preventDefault();
                          handleImport();
                        }
                      }}
                      placeholder={`Start by pasting an existing list of spots here,\nand we will add them to your playlist for you.\n\nFor example\n\n  · Melody, Cute bungalow wine bar with rotating chefs.\n  · Sqirl, Cutest small brunch + lunch place with house jam.\n  · Salazar, Mexican cute outdoor spot with vibes.\n  · 123 Farm, Lavender-themed foods, crafts, and petting zoo.`}
                      className="flex-1 min-h-[12rem] w-full px-4 py-3 border border-subtle rounded-2xl text-body-sm text-primary bg-transparent resize-none outline-none placeholder:text-tertiary focus:border-primary transition-colors"
                    />

                    <div className="flex items-center justify-between mt-3">
                      <p className="text-body-xs text-tertiary">
                        {spotsInput.trim() ? "↵ Press enter to import" : ""}
                      </p>
                      <div className="flex items-center gap-3">
                        {spotsInput.trim() && (
                          <button
                            onClick={handleImport}
                            disabled={importing}
                            className="text-body-sm text-secondary cursor-pointer disabled:opacity-50"
                          >
                            Import
                          </button>
                        )}
                        <button
                          onClick={() => setShareOpen(true)}
                          className="text-body-sm text-primary cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-import: spot list */}
                {imported && (
                  <>
                    {foundSpots.length > 0 && (
                      <p className="text-body-sm text-primary mb-3">
                        {foundSpots.length} spot{foundSpots.length !== 1 ? "s" : ""} ✦
                      </p>
                    )}
                    <div className="space-y-3 mb-4">
                      {foundSpots.map((spot) => (
                        <SpotCard key={spot.google_place_id} spot={spot} />
                      ))}
                    </div>
                  </>
                )}

                {/* Spots added individually */}
                {!imported && foundSpots.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {foundSpots.map((spot) => (
                      <SpotCard key={spot.google_place_id} spot={spot} />
                    ))}
                  </div>
                )}

                {/* Bottom action */}
                {imported || foundSpots.length > 0 ? (
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={<Add className="size-5" />}
                    className="w-full"
                    onClick={() => setSpotSearchOpen(true)}
                  >
                    Add a spot
                  </Button>
                ) : spotsInput.trim() ? (
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? "Importing…" : "Import"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={<Add className="size-5" />}
                    className="w-full"
                    onClick={() => setSpotSearchOpen(true)}
                  >
                    Add a spot
                  </Button>
                )}
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

      {/* Spot search — full-screen on mobile */}
      {spotSearchOpen && (
        <div className="fixed inset-0 z-[70] bg-white overflow-y-auto lg:hidden">
          <div className="flex items-center justify-between p-[var(--space-page-sm)]">
            <button
              onClick={() => setSpotSearchOpen(false)}
              className="text-body-sm text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <p className="text-body-sm-bold text-primary">Add spots</p>
            <button
              onClick={() => setSpotSearchOpen(false)}
              className="text-body-sm text-secondary cursor-pointer"
            >
              Done
            </button>
          </div>
          <div className="px-[var(--space-page-sm)]">
            <SpotSearchInput
              placeholder="Search"
              city={city}
              addedPlaceIds={addedPlaceIds}
              onSelect={handleAddSpotFromSearch}
            />
          </div>
        </div>
      )}

      {/* Share / Publish page */}
      {shareOpen && (
        <div className="fixed inset-0 z-[70] bg-white lg:bg-gray-100 overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="relative flex items-center justify-center p-[var(--space-page-sm)] lg:p-[var(--space-page-md)] shrink-0">
            <button
              onClick={() => setShareOpen(false)}
              className="absolute left-[var(--space-page-sm)] lg:left-[var(--space-page-md)] text-primary cursor-pointer"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-body-sm-bold text-primary">Share</p>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-[var(--space-page-sm)] lg:px-[var(--space-page-md)]">
            {/* Card preview */}
            <div className="w-[200px] lg:w-[240px]">
              <PlaylistCard
                size="md"
                image={coverPreview || defaultCover}
                city={city}
                name={draftName}
              />
            </div>

            {/* Public toggle */}
            <button
              onClick={() => setIsPublic((p) => !p)}
              className="flex items-center gap-2 mt-6 cursor-pointer"
            >
              {isPublic ? (
                <svg className="size-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
                </svg>
              ) : (
                <svg className="size-5 text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              )}
              <span className={`text-body-sm ${isPublic ? "text-blue-500" : "text-tertiary"}`}>
                {isPublic ? "Public" : "Private"}
              </span>
            </button>
          </div>

          {/* Share button */}
          <div className="p-[var(--space-page-sm)] lg:p-[var(--space-page-md)] lg:flex lg:justify-center shrink-0">
            <Button
              variant="filled"
              size="lg"
              darkTheme
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
        </div>
      </BottomPanel>
    </>
  );
}
