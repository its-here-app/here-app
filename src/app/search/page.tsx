"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppBarConfig } from "@/lib/appBarContext";
import { SearchInput } from "@/components/ui/inputs/SearchInput";
import type { SearchInputState } from "@/components/ui/inputs/SearchInput";
import { Avatar } from "@/components/ui/Avatar";
import { PlaylistCard } from "@/components/PlaylistCard";
import { useAuth } from "@/lib/authContext";
import {
  searchPeople,
  searchPlaylists,
  type SearchResultPerson,
  type SearchResultPlaylist,
} from "@/lib/services/search";
import { playlistUrl } from "@/lib/playlistUrl";
import BookmarkButton from "@/components/BookmarkButton";

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [inputState, setInputState] = useState<SearchInputState>("default");
  const [people, setPeople] = useState<SearchResultPerson[]>([]);
  const [playlists, setPlaylists] = useState<SearchResultPlaylist[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (query.length < 1) {
      setPeople([]);
      setPlaylists([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const [peopleRes, playlistsRes] = await Promise.all([
        searchPeople(query, user?.id),
        searchPlaylists(query, user?.id),
      ]);
      setPeople(peopleRes);
      setPlaylists(playlistsRes);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user?.id]);

  function handleClear() {
    setQuery("");
    setPeople([]);
    setPlaylists([]);
    setInputState("focused");
  }

  const hasResults = people.length > 0 || playlists.length > 0;

  return (
    <div className="flex flex-col gap-6 -mt-[var(--space-page-md)] pt-[var(--space-page-sm)]">
      <AppBarConfig hidden />
      {/* Search bar */}
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
        onClear={handleClear}
        placeholder="Search"
      />

      {/* Empty state */}
      {!query && (
        <p className="text-body-xs text-tertiary text-center py-8">
          Search for people or playlists
        </p>
      )}

      {/* Results */}
      {loading && query.length > 0 && !hasResults && (
        <p className="text-body-xs text-tertiary text-center py-8">
          Searching...
        </p>
      )}

      {!loading && query.length > 0 && !hasResults && (
        <p className="text-body-xs text-tertiary text-center py-8">
          No results found
        </p>
      )}

      {/* People */}
      {people.length > 0 && (
        <section>
          <h2 className="text-body-sm text-secondary mb-3">People</h2>
          <ul className="flex flex-col">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/${person.username}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <Avatar
                    size="xl"
                    src={person.avatar_url ?? undefined}
                    username={person.full_name}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-primary font-medium truncate">
                      {person.full_name}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="text-body-xs text-secondary truncate">
                        @{person.username}
                      </p>
                      {person.mutualCount > 0 && (
                        <span className="text-body-xs text-secondary flex-shrink-0">
                          · {person.mutualCount} mutual
                          {person.mutualCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Playlists */}
      {playlists.length > 0 && (
        <section>
          <p className="text-body-sm text-secondary mb-3">
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                size="sm"
                city={playlist.city}
                name={playlist.name}
                image={playlist.cover_photo_url ?? undefined}
                href={playlistUrl(
                  playlist.username,
                  playlist.city,
                  playlist.name,
                  playlist.slug,
                )}
                bottomLeft={
                  <Avatar
                    size="sm"
                    src={playlist.avatar_url ?? undefined}
                    username={playlist.username}
                  />
                }
                topRight={
                  user ? (
                    <span onClick={(e) => e.preventDefault()}>
                      <BookmarkButton
                        playlistId={playlist.id}
                        variant="overlay"
                      />
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
