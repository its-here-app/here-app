"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useSaves } from "@/lib/savesContext";
import { getSavedPlaylists, getSpotMentionsForSpots } from "@/lib/services/saves";
import type { SavedPlaylist } from "@/lib/services/saves";
import type { SpotMention } from "@/lib/spotMentions";
import { formatSpotMentionText } from "@/lib/spotMentions";
import { parseCityFromAddress } from "@/lib/cityDisplay";
import SpotCard from "@/components/SpotCard";
import BookmarkButton from "@/components/BookmarkButton";
import { getDefaultCover } from "@/lib/playlist-covers";
import { playlistUrl } from "@/lib/playlistUrl";
import { PlaylistCard } from "@/components/PlaylistCard";
import {
  SearchInput,
  type SearchInputState,
} from "@/components/ui/inputs/SearchInput";
import { searchSpots } from "@/lib/services/playlists";
import type { SearchResult } from "@/types";
import { AppBarConfig } from "@/lib/appBarContext";
import { AppBarDropdown } from "@/components/AppBarDropdown";
import { BottomPanel } from "@/components/ui/BottomPanel";
import { DropdownList } from "@/components/DropdownList";
import { DropdownListItem } from "@/components/DropdownListItem";
import { Spots } from "@/components/ui/icons/Spots";
import { List } from "@/components/ui/icons/List";
import { Filter } from "@/components/ui/icons/Filter";
import { Chip } from "@/components/ui/Chip";

type SortOrder = "default" | "city" | "top_rated" | "popular";

const SORT_ORDER_LABELS: Record<SortOrder, string> = {
  default: "Default",
  city: "City",
  top_rated: "Rating",
  popular: "Popular",
};

export default function SavesPage() {
  const { user, loading: authLoading } = useAuth();
  const { savedSpots, loading: savesLoading, optimisticRemove, restoreSpot } = useSaves();
  const router = useRouter();

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"spots" | "playlists">(
    searchParams.get("view") === "playlists" ? "playlists" : "spots"
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[] | null>(
    null,
  );
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [searchInputState, setSearchInputState] =
    useState<SearchInputState>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [mentionsBySpotId, setMentionsBySpotId] = useState<
    Map<string, SpotMention>
  >(new Map());

  useEffect(() => {
    if (!authLoading && !user) router.push("/signin");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user || savedSpots.length === 0) return;
    getSpotMentionsForSpots(
      user.id,
      savedSpots.map((s) => s.id)
    ).then(setMentionsBySpotId);
  }, [user, savedSpots]);

  useEffect(() => {
    if (!user || tab !== "playlists" || savedPlaylists !== null) return;
    setPlaylistsLoading(true);
    getSavedPlaylists(user.id).then((data) => {
      setSavedPlaylists(data);
      setPlaylistsLoading(false);
    });
  }, [user, tab, savedPlaylists]);

  const savedPlaceIds = new Set(savedSpots.map((s) => s.google_place_id));

  const displayedSpots =
    sortOrder === "top_rated"
      ? [...savedSpots].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
      : sortOrder === "city"
        ? [...savedSpots].sort((a, b) =>
            (parseCityFromAddress(a.address) ?? "").localeCompare(
              parseCityFromAddress(b.address) ?? ""
            )
          )
        : sortOrder === "popular"
          ? [...savedSpots].sort((a, b) => {
              const mentionDiff =
                (mentionsBySpotId.get(b.id)?.count ?? 0) -
                (mentionsBySpotId.get(a.id)?.count ?? 0);
              return mentionDiff !== 0
                ? mentionDiff
                : (b.rating ?? -1) - (a.rating ?? -1);
            })
          : savedSpots;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await searchSpots(searchQuery);
      setSearchResults(data.filter((r) => !savedPlaceIds.has(r.spot_id)));
    } finally {
      setSearching(false);
    }
  }

  if (authLoading || savesLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppBarConfig
        left={
          <AppBarDropdown
            label={tab === "spots" ? "Spots" : "Playlists"}
            isOpen={dropdownOpen}
            onClick={() => setDropdownOpen((o) => !o)}
          />
        }
        right={
          <Chip
            variant="secondary"
            leftIcon={<Filter className="text-black" />}
            onClick={() => setReorderOpen(true)}
          >
            {SORT_ORDER_LABELS[sortOrder]}
          </Chip>
        }
      />
      <BottomPanel
        isOpen={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        header="Select view"
        desktopVariant="floating"
      >
        <DropdownList>
          <DropdownListItem
            icon={<Spots />}
            label="Spots"
            selected={tab === "spots"}
            onClick={() => {
              setTab("spots");
              router.replace("/saves", { scroll: false });
              setDropdownOpen(false);
            }}
          />
          <DropdownListItem
            icon={<List />}
            label="Playlists"
            selected={tab === "playlists"}
            onClick={() => {
              setTab("playlists");
              router.replace("/saves?view=playlists", { scroll: false });
              setDropdownOpen(false);
            }}
          />
        </DropdownList>
      </BottomPanel>
      <BottomPanel
        isOpen={reorderOpen}
        onClose={() => setReorderOpen(false)}
        header="Re-order"
        desktopVariant="floating"
      >
        <DropdownList>
          <DropdownListItem
            label="Default"
            selected={sortOrder === "default"}
            onClick={() => {
              setSortOrder("default");
              setReorderOpen(false);
            }}
          />
          <DropdownListItem
            label="City"
            selected={sortOrder === "city"}
            onClick={() => {
              setSortOrder("city");
              setReorderOpen(false);
            }}
          />
          <DropdownListItem
            label="Rating"
            selected={sortOrder === "top_rated"}
            onClick={() => {
              setSortOrder("top_rated");
              setReorderOpen(false);
            }}
          />
          <DropdownListItem
            label="Popular"
            selected={sortOrder === "popular"}
            onClick={() => {
              setSortOrder("popular");
              setReorderOpen(false);
            }}
          />
        </DropdownList>
      </BottomPanel>
      <div>
        {/* Spots tab */}
        {tab === "spots" && (
          <div>
            <form onSubmit={handleSearch} className="mb-4">
              <SearchInput
                state={searchInputState}
                value={searchQuery}
                placeholder="Search for a spot to save"
                onFocus={() => setSearchInputState("focused")}
                onBlur={() => setSearchInputState("default")}
                onChange={(v) => {
                  setSearchQuery(v);
                  setSearchInputState(v ? "typing" : "focused");
                }}
                onClear={() => {
                  setSearchQuery("");
                  setSearchResults(null);
                  setSearchInputState("focused");
                }}
              />
            </form>
            <p className="text-body-sm text-secondary py-1 mb-4">
              {savedSpots.length} {savedSpots.length === 1 ? "spot" : "spots"}
            </p>
            {searchResults !== null ? (
              <div className="space-y-3 mb-10">
                {searching && (
                  <p className="text-body-sm text-secondary">Searching…</p>
                )}
                {!searching && searchResults.length === 0 && (
                  <p className="text-body-sm text-secondary">
                    No results found.
                  </p>
                )}
                {searchResults.map((r) => (
                  <div
                    key={r.spot_id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm text-primary truncate">
                        {r.name}
                      </p>
                      <p className="text-body-sm text-secondary truncate">
                        {r.address}
                      </p>
                    </div>
                    <BookmarkButton
                      spot={{
                        google_place_id: r.spot_id,
                        name: r.name,
                        address: r.address,
                        photo_url: r.photo_url,
                        rating: r.rating,
                        types: r.types,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : savedSpots.length === 0 ? (
              <p className="text-body-sm text-secondary">
                No saved spots yet. Search above to find places to save.
              </p>
            ) : (
              <div className="space-y-3">
                {displayedSpots.map((spot) => (
                  <div key={spot.id}>
                    <SpotCard
                      className="flex-1"
                      spot={spot}
                      city={parseCityFromAddress(spot.address) ?? undefined}
                      subtitleText={
                        formatSpotMentionText(
                          mentionsBySpotId.get(spot.id) ?? {
                            count: 0,
                            mostRecentUsername: null,
                          }
                        ) ?? ""
                      }
                      bookmark={<BookmarkButton spot={spot} onRemove={() => optimisticRemove(spot.google_place_id)} onRestore={() => restoreSpot(spot)} />}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playlists tab */}
        {tab === "playlists" && (
          <div>
            {savedPlaylists !== null && (
              <p className="text-body-sm text-secondary py-1 mb-4">
                {savedPlaylists.length}{" "}
                {savedPlaylists.length === 1 ? "playlist" : "playlists"}
              </p>
            )}
            {playlistsLoading ? (
              <p className="text-body-sm text-secondary">Loading…</p>
            ) : !savedPlaylists || savedPlaylists.length === 0 ? (
              <p className="text-body-sm text-secondary">
                No saved playlists yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {savedPlaylists.map(({ id, playlist }) => (
                  <PlaylistCard
                    key={id}
                    size="sm"
                    image={
                      playlist.cover_photo_url ?? getDefaultCover(playlist.city, playlist.name)
                    }
                    city={playlist.city}
                    name={playlist.name}
                    href={playlistUrl(playlist.profiles.username, playlist.city, playlist.name, playlist.slug)}
                    className="w-full"
                    topRight={
                      <span onClick={(e) => e.preventDefault()}>
                        <BookmarkButton
                          playlistId={playlist.id}
                          variant="ghost"
                          className="text-white"
                          onRemove={() => setSavedPlaylists((prev) => prev?.filter((p) => p.playlist_id !== playlist.id) ?? null)}
                          onRestore={() => setSavedPlaylists((prev) => prev ? [{ id, playlist_id: playlist.id, playlist }, ...prev] : null)}
                        />
                      </span>
                    }
                    bottomCenter={
                      <p className="text-body-xs text-neon">@{playlist.profiles.username}</p>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
