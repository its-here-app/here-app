"use client";

import { useState } from "react";
import { searchSpots } from "@/lib/services/playlists";
import type { SearchResult } from "@/types";

interface SpotSearchInputProps {
  placeholder?: string;
  city?: string;
  excludePlaceIds?: Set<string>;
  onSelect?: (result: SearchResult) => void;
  renderAction?: (result: SearchResult) => React.ReactNode;
}

export default function SpotSearchInput({
  placeholder = "Search for a spot…",
  city,
  excludePlaceIds,
  onSelect,
  renderAction,
}: SpotSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

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
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm mb-3">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.spot_id}
              role={onSelect ? "button" : undefined}
              onClick={onSelect ? () => onSelect(result) : undefined}
              className={`bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4 ${onSelect ? "cursor-pointer active:bg-gray-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{result.name}</p>
                <p className="text-xs text-gray-500 truncate">{result.address}</p>
              </div>
              {renderAction?.(result)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
