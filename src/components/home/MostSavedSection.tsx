"use client";

import { useEffect, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import SpotCard from "@/components/SpotCard";
import { SpotSkeletonList } from "./SpotSkeleton";
import { SpotBookmark } from "./SpotBookmark";
import { getTodaysMostSavedSpots } from "@/lib/services/saves";
import type { Spot } from "@/types";

export function MostSavedSection() {
  const [mostSaved, setMostSaved] = useState<
    { spot: Spot; save_count: number }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTodaysMostSavedSpots().then((spots) => {
      setMostSaved(spots);
      setLoaded(true);
    });
  }, []);

  return (
    <CardShelf title="Today's most saved">
      {!loaded ? (
        <SpotSkeletonList />
      ) : mostSaved.length > 0 ? (
        <div className="flex flex-col gap-4">
          {mostSaved.map(({ spot, save_count }) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              subtitleText={`Saved ${save_count} time${save_count !== 1 ? "s" : ""} today`}
              bookmark={<SpotBookmark spot={spot} />}
            />
          ))}
        </div>
      ) : (
        <p className="text-body-xs text-tertiary py-4">
          No spots saved yet today
        </p>
      )}
    </CardShelf>
  );
}
