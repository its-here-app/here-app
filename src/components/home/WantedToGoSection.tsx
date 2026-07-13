"use client";

import { useEffect, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpotBookmark } from "./SpotBookmark";
import { useCarousel, CarouselArrows, CarouselTrack } from "./Carousel";
import { useLazyLoad, timeAgo } from "./hooks";
import { getWantedToGoSpots } from "@/lib/services/saves";
import type { Spot } from "@/types";

export function WantedToGoSection({ userId }: { userId: string }) {
  const { ref, shouldLoad } = useLazyLoad();
  const [spots, setSpots] = useState<{ spot: Spot; saved_at: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { emblaRef, canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useCarousel();

  useEffect(() => {
    if (!shouldLoad || loaded) return;
    getWantedToGoSpots(userId).then((s) => {
      setSpots(s);
      setLoaded(true);
    });
  }, [userId, shouldLoad, loaded]);

  return (
    <div ref={ref}>
      {loaded && spots.length === 0 ? null : (
        <CardShelf
          title="Wanted to go for a while"
          titleRight={
            loaded && spots.length > 0 ? (
              <CarouselArrows
                canScrollPrev={canScrollPrev}
                canScrollNext={canScrollNext}
                scrollPrev={scrollPrev}
                scrollNext={scrollNext}
                scrollableOnDesktop={spots.length > 4}
              />
            ) : undefined
          }
        >
          {!loaded ? (
            <div className="flex gap-2 overflow-hidden -mx-[var(--space-page-sm)] px-[var(--space-page-sm)] lg:mx-0 lg:px-0">
              {[...Array(4)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="w-40 shrink-0 lg:w-[calc(25%-0.375rem)] aspect-square rounded-sm"
                />
              ))}
            </div>
          ) : (
            <CarouselTrack
              emblaRef={emblaRef}
              items={spots}
              itemKey={({ spot }) => spot.id}
              mobileWidthClass="w-40"
              cardsPerView={4}
              renderItem={({ spot, saved_at }) => (
                <Card
                  size="md"
                  image={spot.photo_url ?? undefined}
                  scrim={false}
                  metadata={{
                    title: spot.name,
                    subtitleText: timeAgo(saved_at),
                    rating: spot.rating,
                    types: spot.types,
                  }}
                  metadataRow2={false}
                  truncate
                  metadataRight={<SpotBookmark spot={spot} variant="ghost" />}
                />
              )}
            />
          )}
        </CardShelf>
      )}
    </div>
  );
}
