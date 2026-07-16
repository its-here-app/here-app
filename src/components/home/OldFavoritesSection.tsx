"use client";

import { useEffect, useState } from "react";
import { CardShelf } from "@/components/ui/CardShelf";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpotBookmark } from "./SpotBookmark";
import { useCarousel, CarouselArrows, CarouselTrack } from "./Carousel";
import { useLazyLoad } from "./hooks";
import { getOldFavoriteSpots } from "@/lib/services/saves";
import type { Spot } from "@/types";

export function OldFavoritesSection({
  userId,
  cityId,
}: {
  userId: string;
  cityId?: string | null;
}) {
  const { ref, shouldLoad } = useLazyLoad();
  const [favorites, setFavorites] = useState<
    { spot: Spot; playlist_name: string }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  const { emblaRef, canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useCarousel();

  useEffect(() => {
    if (!shouldLoad) return;
    getOldFavoriteSpots(userId, cityId).then((s) => {
      setFavorites(s);
      setLoaded(true);
    });
  }, [userId, cityId, shouldLoad]);

  if (loaded && favorites.length === 0) {
    return null;
  }

  return (
    <div ref={ref}>
      <CardShelf
        title="Revisit your old favorites"
        titleRight={
          loaded && favorites.length > 0 ? (
            <CarouselArrows
              canScrollPrev={canScrollPrev}
              canScrollNext={canScrollNext}
              scrollPrev={scrollPrev}
              scrollNext={scrollNext}
              scrollableOnDesktop={favorites.length > 4}
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
            items={favorites}
            itemKey={({ spot }) => spot.id}
            mobileWidthClass="w-40"
            cardsPerView={4}
            renderItem={({ spot, playlist_name }) => (
              <Card
                size="md"
                image={spot.photo_url ?? undefined}
                scrim={false}
                metadata={{
                  title: spot.name,
                  subtitleText: playlist_name,
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
    </div>
  );
}
