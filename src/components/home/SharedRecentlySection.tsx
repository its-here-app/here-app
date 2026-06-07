"use client";

import { useEffect, useState, useCallback } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import { PlaylistCard } from "@/components/PlaylistCard";
import { IconButton } from "@/components/ui/IconButton";
import { Avatar } from "@/components/ui/Avatar";
import { ArrowLeft } from "@/components/ui/icons/ArrowLeft";
import { ArrowRight } from "@/components/ui/icons/ArrowRight";
import { Skeleton } from "@/components/ui/Skeleton";
import { getRecentFollowingPlaylists } from "@/lib/services/playlists";
import { playlistUrl } from "@/lib/playlistUrl";
import useEmblaCarousel from "embla-carousel-react";
import type { Playlist } from "@/types";

export function SharedRecentlySection({ userId }: { userId: string }) {
  const [playlists, setPlaylists] = useState<
    (Playlist & { username: string; avatar_url: string | null })[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
  });
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    getRecentFollowingPlaylists(userId).then((p) => {
      setPlaylists(p);
      setLoaded(true);
    });
  }, [userId]);

  return (
    <CardShelf
      title="Shared recently"
      titleRight={
        loaded && playlists.length > 0 ? (
          <div
            className={`gap-2 ${playlists.length <= 3 ? "hidden [@media(hover:hover)]:max-lg:flex" : "hidden [@media(hover:hover)]:flex"}`}
          >
            <IconButton
              variant="secondary"
              icon={<ArrowLeft className="size-6" />}
              onClick={scrollPrev}
            />
            <IconButton
              variant="secondary"
              icon={<ArrowRight className="size-6" />}
              onClick={scrollNext}
            />
          </div>
        ) : undefined
      }
    >
      {!loaded ? (
        <div className="flex gap-2 overflow-hidden -mx-[var(--space-page-sm)] px-[var(--space-page-sm)]">
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={i}
              className="w-60 shrink-0 lg:w-[calc(33.333%-0.333rem)] aspect-square rounded-sm"
            />
          ))}
        </div>
      ) : playlists.length > 0 ? (
        <div
          ref={emblaRef}
          className="overflow-hidden -mx-[var(--space-page-sm)]"
        >
          <div className="flex gap-2 px-[var(--space-page-sm)]">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="w-60 shrink-0 lg:w-[calc(33.333%-0.333rem)]"
              >
                <PlaylistCard
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
                />
              </div>
            ))}
            <div className="w-0 shrink-0 lg:hidden" />
          </div>
        </div>
      ) : (
        <p className="text-body-xs text-tertiary py-4">
          Follow people to see their playlists here
        </p>
      )}
    </CardShelf>
  );
}
