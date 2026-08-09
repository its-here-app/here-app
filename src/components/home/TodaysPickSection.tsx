"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/ui/Avatar";
import { FeaturedSpotSkeleton } from "./SpotSkeleton";
import { SpotBookmark } from "./SpotBookmark";
import { getTodaysPick } from "@/lib/services/playlists";
import { playlistUrl } from "@/lib/playlistUrl";
import type { TodaysPick } from "@/types";

function MentionSubtitle({ mentionedBy }: { mentionedBy: TodaysPick["mentionedBy"] }) {
  if (!mentionedBy) return null;
  const { playlistName, username, avatarUrl, slug, city, count } = mentionedBy;
  const others = count - 1;
  return (
    <Link
      href={playlistUrl(username, city, playlistName, slug)}
      className="flex items-center gap-1 min-w-0 hover:underline"
    >
      <span className="truncate">Mentioned in {playlistName} by</span>
      <Avatar size="sm" src={avatarUrl ?? undefined} alt={username} />
      {others > 0 && (
        <span className="whitespace-nowrap">
          & {others} other{others === 1 ? "" : "s"}
        </span>
      )}
    </Link>
  );
}

export function TodaysPickSection({
  userId,
  cityId,
}: {
  userId?: string | null;
  cityId?: string | null;
}) {
  const [pick, setPick] = useState<TodaysPick | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodaysPick(userId, cityId).then((p) => {
      setPick(p);
      setLoaded(true);
    });
  }, [userId, cityId]);

  if (loaded && !pick) return null;

  return !loaded ? (
    <FeaturedSpotSkeleton />
  ) : (
    <Card
      size="featured"
      image={pick!.spot.photo_url ?? undefined}
      href={`https://www.google.com/maps/place/?q=place_id:${pick!.spot.google_place_id}`}
      external
      scrim={false}
      sticker
      metadata={{
        title: pick!.spot.name,
        subtitleContent: pick!.mentionedBy ? (
          <MentionSubtitle mentionedBy={pick!.mentionedBy} />
        ) : undefined,
        rating: pick!.spot.rating,
        types: pick!.spot.types,
        city: pick!.city,
      }}
      metadataRight={<SpotBookmark spot={pick!.spot} />}
    />
  );
}
