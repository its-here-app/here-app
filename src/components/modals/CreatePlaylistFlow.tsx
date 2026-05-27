"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { BottomPanel } from "@/components/ui/BottomPanel";
import { TextInput } from "@/components/ui/inputs";
import { CityAutocompleteInput } from "@/components/ui/inputs/CityAutocompleteInput";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { snackbar } from "@/components/ui/Snackbar";
import { Error } from "@/components/ui/icons/Error";
import { Photo } from "@/components/ui/icons/Photo";
import { PlaylistCard } from "@/components/PlaylistCard";
import SpotCard from "@/components/SpotCard";
import { getDefaultCover } from "@/lib/playlist-covers";
import { resolveSpot, upsertSpot, uploadPlaylistCover } from "@/lib/services/playlists";
import { randomPlaylistName } from "@/lib/playlistNames";
import { createPlaylistAction } from "@/lib/actions/playlists";
import { upsertCityAction } from "@/lib/actions/cities";
import type { DraftSpot } from "@/types";

// ─── Imperative trigger ───────────────────────────────────────────────────────

type OpenListener = () => void;
const listeners: OpenListener[] = [];

export function openCreatePlaylist() {
  listeners.forEach((fn) => fn());
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
  const [saving, setSaving] = useState(false);

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
    setSaving(false);
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

    const lines = spotsInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const foundTemp: DraftSpot[] = [];
    const unfoundTemp: string[] = [];

    for (const line of lines) {
      const commaIdx = line.indexOf(",");
      const spotName = commaIdx === -1 ? line.trim() : line.slice(0, commaIdx).trim();
      const notes = commaIdx === -1 ? undefined : line.slice(commaIdx + 1).trim() || undefined;

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

    if (unfoundTemp.length > 0) {
      snackbar({
        icon: <Error />,
        message: `${unfoundTemp.length} missing spot${unfoundTemp.length === 1 ? "" : "s"}`,
        actionLabel: "See more",
        onAction: () => setMissingPanelOpen(true),
      });
    }
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

      {/* Steps 3–5 — Create Overlay */}
      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-white overflow-y-auto p-[var(--space-page-sm)] lg:pb-0"
          style={{
            animation: `${overlayClosing ? "fadeOut" : "fadeIn"} 250ms ease forwards`,
          }}
        >
          <div className="w-full lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            {/* Left — PlaylistCard */}
            <div className="relative mb-6 lg:mb-0 lg:sticky lg:top-0 lg:h-[calc(100vh-2*var(--space-page-sm))]">
              <PlaylistCard
                className="h-[30rem] lg:h-full"
                size="hero"
                image={coverPreview || defaultCover}
                city={city}
                name={draftName}
                onNameChange={(v) => { setDraftName(v); if (v.trim()) lastNameRef.current = v; }}
                onNameBlur={(v) => { if (!v.trim()) setDraftName(lastNameRef.current); }}
                autoFocusName
                topLeft={
                  <button
                    onClick={() => setConfirmCancelOpen(true)}
                    className="text-body-xs text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                }
                topCenter={
                  <p className="text-body-sm-bold text-white">New playlist</p>
                }
                topRight={
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-body-xs text-white cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Done"}
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
                accept="image/*"
                className="sr-only"
                onChange={handleCoverChange}
              />
            </div>

            {/* Right — Form */}
            <div className="pb-[var(--space-page-sm)]">
              <div className="space-y-4 mb-6">
                <TextInput
                  label="Add spots (one per line)"
                  size="tall"
                  lightMode
                  value={spotsInput}
                  onChange={(e) => setSpotsInput(e.target.value)}
                  placeholder={`Blue Bottle Coffee\nTartine Bakery\nGolden Gate Park`}
                />

                {/* Public / Private toggle */}
                <button
                  onClick={() => setIsPublic((p) => !p)}
                  className="text-body-xs text-secondary cursor-pointer"
                >
                  {isPublic ? "Public" : "Private"} — tap to change
                </button>
                <div>
                  <Button
                    variant="tonal"
                    size="md"
                    onClick={handleImport}
                    disabled={importing || !spotsInput.trim()}
                  >
                    {importing ? "Importing…" : "Import"}
                  </Button>
                </div>
              </div>

              {/* Found spots */}
              {foundSpots.length > 0 && (
                <div className="space-y-3">
                  {foundSpots.map((spot) => (
                    <SpotCard key={spot.google_place_id} spot={spot} />
                  ))}
                </div>
              )}
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
              <li key={name} className="">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </BottomPanel>
    </>
  );
}
