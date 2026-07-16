"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { FeaturedSpotSkeleton } from "./SpotSkeleton";
import { SpotBookmark } from "./SpotBookmark";
import { getTodaysPick } from "@/lib/services/playlists";
import type { TodaysPick } from "@/types";

export function TodaysPickSection({ cityId }: { cityId?: string | null }) {
  const [pick, setPick] = useState<TodaysPick | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodaysPick(cityId).then((p) => {
      setPick(p);
      setLoaded(true);
    });
  }, [cityId]);

  if (loaded && !pick) return null;

  return !loaded ? (
    <FeaturedSpotSkeleton />
  ) : (
    <Card
      size="featured"
      image={pick!.spot.photo_url ?? undefined}
      scrim={false}
      sticker
      metadata={{
        title: pick!.spot.name,
        subtitleText: `From ${pick!.playlist_name} by @${pick!.username}`,
        rating: pick!.spot.rating,
        types: pick!.spot.types,
        city: pick!.playlist_city,
      }}
      metadataRight={<SpotBookmark spot={pick!.spot} />}
    />
  );
}
