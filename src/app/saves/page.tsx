"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useSaves } from "@/lib/savesContext";
import {
  getSavedPlaylists,
  getSpotMentionsForSpots,
} from "@/lib/services/saves";
import type { SavedPlaylist } from "@/lib/services/saves";
import type { SpotMention } from "@/lib/spotMentions";
import { formatSpotMentionText, getFeaturedSaver } from "@/lib/spotMentions";
import { parseCityFromAddress } from "@/lib/cityDisplay";
import SpotCard from "@/components/SpotCard";
import { SpotSkeletonList } from "@/components/home/SpotSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import BookmarkButton from "@/components/BookmarkButton";
import { SpotSearchPanel } from "@/components/SpotSearchPanel";
import type { SearchResult } from "@/types";
import { getDefaultCover } from "@/lib/playlist-covers";
import { playlistUrl } from "@/lib/playlistUrl";
import { Card } from "@/components/Card";
import {
  SearchInput,
  type SearchInputState,
} from "@/components/ui/inputs/SearchInput";
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
  const { savedSpots, loading: savesLoading } = useSaves();
  const router = useRouter();

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"spots" | "playlists">(
    searchParams.get("view") === "playlists" ? "playlists" : "spots",
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [spotSearchOpen, setSpotSearchOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[] | null>(
    null,
  );
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [searchInputState, setSearchInputState] =
    useState<SearchInputState>("default");
  const [searchQuery, setSearchQuery] = useState("");
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
      savedSpots.map((s) => s.id),
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

  const sortedSpots =
    sortOrder === "top_rated"
      ? [...savedSpots].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
      : sortOrder === "city"
        ? [...savedSpots].sort((a, b) =>
            (parseCityFromAddress(a.address) ?? "").localeCompare(
              parseCityFromAddress(b.address) ?? "",
            ),
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

  const query = searchQuery.trim().toLowerCase();
  const usernameQuery = query.replace(/^@/, "");
  const displayedSpots = query
    ? sortedSpots.filter((spot) => {
        const mention = mentionsBySpotId.get(spot.id);
        return (
          spot.name.toLowerCase().includes(query) ||
          spot.address.toLowerCase().includes(query) ||
          (mention?.savers.some((s) =>
            s.username.toLowerCase().includes(usernameQuery),
          ) ??
            false)
        );
      })
    : sortedSpots;

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppBarConfig
        hidden={spotSearchOpen}
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
      <div className={spotSearchOpen ? "lg:hidden" : undefined}>
        {/* Spots tab */}
        {tab === "spots" && (
          <div>
            <div className="mb-4">
              <SearchInput
                state={searchInputState}
                value={searchQuery}
                placeholder="Search"
                onFocus={() => setSearchInputState("focused")}
                onBlur={() => {
                  if (!searchQuery) setSearchInputState("default");
                }}
                onChange={(v) => {
                  setSearchQuery(v);
                  setSearchInputState(v ? "typing" : "focused");
                }}
                onClear={() => {
                  setSearchQuery("");
                  setSearchInputState("focused");
                }}
              />
            </div>
            {savesLoading ? (
              <Skeleton className="h-[1em] w-20 rounded-full py-1 mb-4" />
            ) : (
              <p className="text-body-sm text-secondary py-1 mb-4">
                {displayedSpots.length}{" "}
                {displayedSpots.length === 1 ? "spot" : "spots"}
              </p>
            )}
            {savesLoading ? (
              <SpotSkeletonList />
            ) : savedSpots.length === 0 ? (
              <EmptyState
                header="Nothing saved yet"
                message="Save spots you love to see them here."
                actionLabel="Start exploring"
                onAction={() => router.push("/")}
              />
            ) : displayedSpots.length === 0 ? (
              <EmptyState
                message={`No saves match "${searchQuery}".\n\nThis spot might exist — just not saved yet!`}
                actionLabel="Search all places"
                onAction={() => setSpotSearchOpen(true)}
              />
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
                            savers: [],
                          },
                          getFeaturedSaver(
                            mentionsBySpotId.get(spot.id),
                            searchQuery,
                          )?.username ?? null,
                        ) ?? ""
                      }
                      bookmark={<BookmarkButton spot={spot} />}
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
            {playlistsLoading ? (
              <Skeleton className="h-[1em] w-24 rounded-full py-1 mb-4" />
            ) : (
              savedPlaylists !== null && (
                <p className="text-body-sm text-secondary py-1 mb-4">
                  {savedPlaylists.length}{" "}
                  {savedPlaylists.length === 1 ? "playlist" : "playlists"}
                </p>
              )
            )}
            {playlistsLoading ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-sm" />
                ))}
              </div>
            ) : !savedPlaylists || savedPlaylists.length === 0 ? (
              <EmptyState
                header="Nothing saved yet"
                message="Save playlists you love to see them here."
                actionLabel="Start exploring"
                onAction={() => router.push("/")}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {savedPlaylists.map(({ id, playlist }) => (
                  <Card
                    key={id}
                    size="sm"
                    image={
                      playlist.cover_photo_url ??
                      getDefaultCover(playlist.city, playlist.name)
                    }
                    city={playlist.city}
                    name={playlist.name}
                    href={playlistUrl(
                      playlist.profiles.username,
                      playlist.city,
                      playlist.name,
                      playlist.slug,
                    )}
                    className="w-full"
                    topRight={
                      <span onClick={(e) => e.preventDefault()}>
                        <BookmarkButton
                          playlistId={playlist.id}
                          variant="ghost"
                          className="text-white"
                          onRemove={() =>
                            setSavedPlaylists(
                              (prev) =>
                                prev?.filter(
                                  (p) => p.playlist_id !== playlist.id,
                                ) ?? null,
                            )
                          }
                          onRestore={() =>
                            setSavedPlaylists((prev) =>
                              prev
                                ? [
                                    { id, playlist_id: playlist.id, playlist },
                                    ...prev,
                                  ]
                                : null,
                            )
                          }
                        />
                      </span>
                    }
                    bottomCenter={
                      <p className="text-body-xs text-neon">
                        @{playlist.profiles.username}
                      </p>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div
        className={
          spotSearchOpen
            ? "lg:flex lg:flex-col lg:h-[calc(100vh-2*var(--space-page-sm))]"
            : undefined
        }
      >
        <SpotSearchPanel
          isOpen={spotSearchOpen}
          onClose={() => {
            setSpotSearchOpen(false);
            setSearchQuery("");
            setSearchInputState("default");
          }}
          onSelect={() => {}}
          initialQuery={searchQuery}
          contentClassName="mt-2"
          renderAction={(result: SearchResult) => (
            <BookmarkButton
              spot={{
                google_place_id: result.spot_id,
                name: result.name,
                address: result.address,
                photo_url: result.photo_url,
                rating: result.rating,
                types: result.types,
              }}
              variant="ghost"
            />
          )}
        />
      </div>
    </main>
  );
}
