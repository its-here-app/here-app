"use client";

import { useState, useRef } from "react";
import { searchSpots } from "@/lib/services/playlists";
import type { SearchResult } from "@/types";

interface SpotSearchInputProps {
  placeholder?: string;
  city?: string;
  addedPlaceIds?: Set<string>;
  excludePlaceIds?: Set<string>;
  onSelect?: (result: SearchResult) => void;
  renderAction?: (result: SearchResult) => React.ReactNode;
}

export default function SpotSearchInput({
  placeholder = "Search for a spot…",
  city,
  addedPlaceIds,
  excludePlaceIds,
  onSelect,
  renderAction,
}: SpotSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const data = await searchSpots(query, city);
      setResults(
        excludePlaceIds ? data.filter((r) => !excludePlaceIds.has(r.spot_id)) : data
      );
    } catch {
      setError("Failed to search spots.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 border border-transparent rounded-[12px] bg-gray-100 focus-within:bg-white focus-within:border-subtle transition-colors">
          <svg className="size-4 text-tertiary shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="flex-1 text-body-sm text-primary bg-transparent outline-none placeholder:text-tertiary"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              className="text-tertiary cursor-pointer shrink-0"
            >
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="text-body-xs text-red-500 mb-3">{error}</p>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-body-xs text-tertiary mb-2 px-1">Popular spots</p>
          <div className="divide-y divide-subtle">
            {results.map((result) => (
              <div
                key={result.spot_id}
                role={onSelect ? "button" : undefined}
                onClick={onSelect ? () => onSelect(result) : undefined}
                className={`flex items-center gap-3 py-3 ${onSelect ? "cursor-pointer active:bg-gray-50" : ""}`}
              >
                {result.photo_url ? (
                  <img
                    src={result.photo_url}
                    alt=""
                    className="size-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="size-10 rounded-lg bg-gray-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-primary truncate">{result.name}</p>
                  <p className="text-body-xs text-tertiary truncate">{result.address}</p>
                </div>
                {addedPlaceIds?.has(result.spot_id) ? (
                  <svg className="size-5 text-primary shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="size-5 text-tertiary shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 6.5v7M6.5 10h7" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
