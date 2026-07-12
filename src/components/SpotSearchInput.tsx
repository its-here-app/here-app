"use client";

import { useEffect, useRef, useState } from "react";
import { searchSpots, getPopularSpotsForCity } from "@/lib/services/playlists";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { SearchInput } from "@/components/ui/inputs/SearchInput";
import type { SearchInputState } from "@/components/ui/inputs/SearchInput";
import { Add } from "@/components/ui/icons/Add";
import { CheckCircle } from "@/components/ui/icons/CheckCircle";
import { IconButton } from "@/components/ui/IconButton";
import SpotCard from "@/components/SpotCard";
import type { SearchResult } from "@/types";

// Searches automatically after the user pauses typing, instead of requiring
// Enter. Costs more Google Places Text Search calls ($32/1k) than Enter-only,
// since partial queries aren't cache hits — flip to false to fall back to
// Enter-to-search only if that cost needs to come down.
const DEBOUNCE_SEARCH = true;
const DEBOUNCE_MS = 400;

// Keeps the empty-query suggestion list short enough to scan at a glance.
const POPULAR_SPOTS_LIMIT = 5;

interface SpotSearchInputProps {
  placeholder?: string;
  city?: string;
  cityId?: string;
  addedPlaceIds?: Set<string>;
  excludePlaceIds?: Set<string>;
  onSelect?: (result: SearchResult) => void;
  renderAction?: (result: SearchResult) => React.ReactNode;
  initialQuery?: string;
}

export default function SpotSearchInput({
  placeholder = "Search for a spot…",
  city,
  cityId,
  addedPlaceIds,
  excludePlaceIds,
  onSelect,
  renderAction,
  initialQuery = "",
}: SpotSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [popularSpots, setPopularSpots] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [inputState, setInputState] = useState<SearchInputState>(
    initialQuery ? "typing" : "default",
  );
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  // Read via a ref (not a effect dependency) so adding a spot during the
  // session doesn't re-trigger the fetch below — only spots already in the
  // playlist *at load time* get filtered out; ones added after stay visible.
  const addedPlaceIdsRef = useRef(addedPlaceIds);
  addedPlaceIdsRef.current = addedPlaceIds;

  async function performSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setError("");
    try {
      const data = await searchSpots(q, city);
      setResults(
        excludePlaceIds ? data.filter((r) => !excludePlaceIds.has(r.spot_id)) : data
      );
    } catch {
      setError("Failed to search spots.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    if (DEBOUNCE_SEARCH) performSearch(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    if (!cityId) {
      setPopularSpots([]);
      return;
    }
    let cancelled = false;
    getPopularSpotsForCity(cityId, POPULAR_SPOTS_LIMIT).then((data) => {
      if (cancelled) return;
      const alreadyAdded = addedPlaceIdsRef.current;
      setPopularSpots(
        alreadyAdded ? data.filter((s) => !alreadyAdded.has(s.spot_id)) : data,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await performSearch(query);
  }

  function renderSpotRow(result: SearchResult) {
    return (
      <SpotCard
        key={result.spot_id}
        spot={{
          google_place_id: result.spot_id,
          name: result.name,
          address: result.address,
          photo_url: result.photo_url,
          rating: result.rating,
          types: result.types,
        }}
        size="xxsmall"
        disableLink
        onClick={onSelect ? () => onSelect(result) : undefined}
        action={
          renderAction ? (
            renderAction(result)
          ) : addedPlaceIds?.has(result.spot_id) ? (
            <IconButton variant="ghost" icon={<CheckCircle focus className="size-6 text-primary" />} label="Added" onClick={() => onSelect?.(result)} />
          ) : (
            <IconButton variant="ghost" icon={<Add className="size-6" />} label="Add spot" onClick={() => onSelect?.(result)} />
          )
        }
      />
    );
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4">
        <SearchInput
          state={inputState}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setInputState(v ? "typing" : "focused");
          }}
          onFocus={() => setInputState(query ? "typing" : "focused")}
          onBlur={() => {
            if (!query) setInputState("default");
          }}
          onClear={() => {
            setQuery("");
            setResults([]);
            setInputState("focused");
          }}
          placeholder={placeholder}
        />
      </form>

      {error && (
        <p className="text-body-xs text-red-500 mb-3">{error}</p>
      )}

      {!query.trim() && popularSpots.length > 0 && (
        <div>
          <p className="text-body-sm text-tertiary mb-2 px-1">Popular spots</p>
          <div className="space-y-3">
            {popularSpots.map(renderSpotRow)}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-body-sm text-tertiary mb-2 px-1">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          <div className="space-y-3">
            {results.map(renderSpotRow)}
          </div>
        </div>
      )}
    </div>
  );
}
