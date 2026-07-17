"use client";

import { useEffect, useMemo, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import { Card } from "@/components/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Add } from "@/components/ui/icons/Add";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPlaylistsByUser } from "@/lib/services/playlists";
import { getUserUsername } from "@/lib/services/users";
import { playlistUrl } from "@/lib/playlistUrl";
import { formatCityDisplay } from "@/lib/cityDisplay";
import { getDefaultCover } from "@/lib/playlist-covers";
import { openCreatePlaylist } from "@/components/modals/CreatePlaylistFlow";
import type { Playlist } from "@/types";

interface CityForCreate {
  google_place_id: string;
  display_name: string;
  is_primary?: boolean;
}

export function YourPlaylistsSection({
  userId,
  cityId,
  city,
}: {
  userId: string;
  cityId?: string | null;
  city?: CityForCreate | null;
}) {
  const [latestPlaylist, setLatestPlaylist] = useState<Playlist | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const displayCityName = city ? formatCityDisplay(city.display_name, city.is_primary) : undefined;
  const emptyStateCover = useMemo(() => getDefaultCover(displayCityName ?? ""), [displayCityName]);

  useEffect(() => {
    getUserUsername(userId).then(setUsername);
    getPlaylistsByUser(userId, cityId).then((playlists) => {
      setLatestPlaylist(playlists[0] ?? null);
      setLoaded(true);
    });
  }, [userId, cityId]);

  return (
    <CardShelf title="Your playlists">
      {!loaded ? (
        <div className="flex items-center gap-2 bg-surface-subtle rounded-sm p-2 w-full">
          <Skeleton className="shrink-0 size-[3.125rem] rounded-xs" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-1/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ) : latestPlaylist && username ? (
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-2">
          <Card
            size="xs"
            city={latestPlaylist.city}
            name={latestPlaylist.name}
            subtitle={latestPlaylist.description ?? undefined}
            image={latestPlaylist.cover_photo_url ?? undefined}
            href={playlistUrl(username, latestPlaylist.city, latestPlaylist.name, latestPlaylist.slug)}
          />
          <div
            role="button"
            onClick={() => openCreatePlaylist(city ?? undefined)}
            className="hidden lg:flex items-center gap-2 bg-transparent border border-grey-300 rounded-sm py-2 px-4 w-full overflow-hidden text-left cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-xs text-tertiary text-balance">
                Create more playlists for us to learn your taste and recommend you spots you may like
              </p>
            </div>
            <IconButton
              variant="secondary"
              icon={<Add />}
              label="Start a new playlist"
              onClick={(e) => {
                e.stopPropagation();
                openCreatePlaylist(city ?? undefined);
              }}
            />
          </div>
        </div>
      ) : (
        <Card
          size="xs"
          city={displayCityName}
          name="Create a playlist"
          image={emptyStateCover}
          onClick={() => openCreatePlaylist(city ?? undefined)}
        />
      )}
    </CardShelf>
  );
}
