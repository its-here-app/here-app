"use client";

import { useEffect, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCarousel, CarouselArrows, CarouselTrack } from "./Carousel";
import { getExplorePlaylists } from "@/lib/services/playlists";
import { playlistUrl } from "@/lib/playlistUrl";
import type { Playlist } from "@/types";

export function ExplorePlaylistsSection({ userId }: { userId: string }) {
  const [playlists, setPlaylists] = useState<
    (Playlist & { username: string; avatar_url: string | null })[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  const { emblaRef, canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useCarousel();

  useEffect(() => {
    getExplorePlaylists(userId).then((p) => {
      setPlaylists(p);
      setLoaded(true);
    });
  }, [userId]);

  if (loaded && playlists.length === 0) return null;

  return (
    <CardShelf
      title="Explore playlists"
      titleRight={
        loaded && playlists.length > 0 ? (
          <CarouselArrows
            canScrollPrev={canScrollPrev}
            canScrollNext={canScrollNext}
            scrollPrev={scrollPrev}
            scrollNext={scrollNext}
            scrollableOnDesktop={playlists.length > 3}
          />
        ) : undefined
      }
    >
      {!loaded ? (
        <div className="flex gap-2 overflow-hidden -mx-[var(--space-page-sm)] px-[var(--space-page-sm)] lg:mx-0 lg:px-0">
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={i}
              className="w-60 shrink-0 lg:w-[calc(33.333%-0.333rem)] aspect-square rounded-sm"
            />
          ))}
        </div>
      ) : (
        <CarouselTrack
          emblaRef={emblaRef}
          items={playlists}
          itemKey={(playlist) => playlist.id}
          cardsPerView={3}
          renderItem={(playlist) => (
            <Card
              size="md"
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
              bottomRight={
                <span className="text-body-xs text-neon">
                  {playlist.spot_count ?? 0}
                </span>
              }
            />
          )}
        />
      )}
    </CardShelf>
  );
}
