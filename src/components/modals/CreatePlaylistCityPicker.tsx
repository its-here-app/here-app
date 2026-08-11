"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomPanel } from "@/components/ui/BottomPanel";
import { CityAutocompleteInput } from "@/components/ui/inputs/CityAutocompleteInput";
import { Button } from "@/components/ui/Button";
import { formatCityDisplay } from "@/lib/cityDisplay";

// ─── Imperative trigger ───────────────────────────────────────────────────────

export interface InitialCity {
  google_place_id: string;
  display_name: string;
  is_primary?: boolean;
}

type OpenListener = (initialCity?: InitialCity) => void;
const listeners: OpenListener[] = [];

/**
 * Opens the create-playlist city picker. Pass `initialCity` when the city is
 * already known from context (e.g. the home page's city filter) to skip
 * straight past picking, leaving only "Create" to confirm it.
 */
export function openCreatePlaylist(initialCity?: InitialCity) {
  listeners.forEach((fn) => fn(initialCity));
}

/**
 * Global city-picker step for starting a new playlist. Lives outside the
 * `/new` route (and is mounted once in the root layout) so it can be
 * triggered from anywhere without navigating first. Once a city is
 * confirmed, it hands off to `/new?place_id=...&name=...` — the rest of the
 * create-playlist flow lives there as a real page.
 */
export function CreatePlaylistCityPicker() {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [city, setCity] = useState("");
  const [selectedCity, setSelectedCity] = useState<InitialCity | null>(null);
  // Hides the state/country suffix for primary cities ("Portland, OR" ->
  // "Portland"), matching how city names render elsewhere in the app.
  const displayCity = formatCityDisplay(city, selectedCity?.is_primary);

  useEffect(() => {
    const listener: OpenListener = (initialCity) => {
      // Guards against `openCreatePlaylist` being passed directly as a DOM
      // event handler (e.g. `onClick={openCreatePlaylist}`), which would
      // otherwise pass the click SyntheticEvent through as `initialCity`.
      const validCity = initialCity?.display_name ? initialCity : undefined;
      if (validCity) {
        setCity(validCity.display_name);
        setSelectedCity(validCity);
      } else {
        setCity("");
        setSelectedCity(null);
      }
      setPanelOpen(true);
    };
    listeners.push(listener);
    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  function handleCreate() {
    if (!selectedCity?.google_place_id || !city?.trim()) return;
    const params = new URLSearchParams({
      place_id: selectedCity.google_place_id,
      name: selectedCity.display_name,
    });
    if (selectedCity.is_primary) params.set("primary", "1");
    setPanelOpen(false);
    router.push(`/new?${params.toString()}`);
  }

  return (
    <BottomPanel
      isOpen={panelOpen}
      onClose={() => setPanelOpen(false)}
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
          disabled={!selectedCity?.google_place_id || !city?.trim()}
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
          disabled={!selectedCity?.google_place_id || !city?.trim()}
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
  );
}
