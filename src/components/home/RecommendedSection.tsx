"use client";

import { useEffect, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import SpotCard from "@/components/SpotCard";
import { SpotSkeletonList } from "./SpotSkeleton";
import { SpotBookmark } from "./SpotBookmark";
import { useLazyLoad } from "./hooks";
import { getRecommendedSpots } from "@/lib/services/saves";
import type { Spot } from "@/types";

export function RecommendedSection({
  userId,
  cityId,
}: {
  userId: string;
  cityId?: string | null;
}) {
  const { ref, shouldLoad } = useLazyLoad();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!shouldLoad) return;
    getRecommendedSpots(userId, cityId).then((s) => {
      setSpots(s);
      setLoaded(true);
    });
  }, [userId, cityId, shouldLoad]);

  return (
    <div ref={ref}>
      {loaded && spots.length === 0 ? null : (
        <CardShelf title="Spots you might like">
          {!loaded ? (
            <SpotSkeletonList />
          ) : (
            <div className="flex flex-col gap-4">
              {spots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  bookmark={<SpotBookmark spot={spot} />}
                />
              ))}
            </div>
          )}
        </CardShelf>
      )}
    </div>
  );
}
