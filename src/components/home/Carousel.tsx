"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { IconButton } from "@/components/ui/IconButton";
import { ArrowLeft } from "@/components/ui/icons/ArrowLeft";
import { ArrowRight } from "@/components/ui/icons/ArrowRight";

export function useCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  return {
    emblaRef,
    canScrollPrev,
    canScrollNext,
    scrollPrev: useCallback(() => emblaApi?.scrollPrev(), [emblaApi]),
    scrollNext: useCallback(() => emblaApi?.scrollNext(), [emblaApi]),
  };
}

interface CarouselArrowsProps {
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  /** Whether the track ever needs scrolling at lg+ (hides arrows there if not) */
  scrollableOnDesktop: boolean;
}

export function CarouselArrows({
  canScrollPrev,
  canScrollNext,
  scrollPrev,
  scrollNext,
  scrollableOnDesktop,
}: CarouselArrowsProps) {
  return (
    <div
      className={`gap-2 ${scrollableOnDesktop ? "hidden [@media(hover:hover)]:flex" : "hidden [@media(hover:hover)]:max-lg:flex"}`}
    >
      <IconButton
        variant="secondary"
        icon={<ArrowLeft className="size-6" />}
        onClick={scrollPrev}
        disabled={!canScrollPrev}
      />
      <IconButton
        variant="secondary"
        icon={<ArrowRight className="size-6" />}
        onClick={scrollNext}
        disabled={!canScrollNext}
      />
    </div>
  );
}

export type CarouselCardsPerView = 2 | 3 | 4 | 5;

// Literal strings (not computed at runtime) so Tailwind's build-time scan picks them up.
const desktopWidthClass: Record<CarouselCardsPerView, string> = {
  2: "lg:w-[calc(50%-0.25rem)]",
  3: "lg:w-[calc(33.333%-0.333rem)]",
  4: "lg:w-[calc(25%-0.375rem)]",
  5: "lg:w-[calc(20%-0.4rem)]",
};

interface CarouselTrackProps<T> {
  emblaRef: (node: HTMLElement | null) => void;
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Fixed width per card below lg, e.g. "w-60" */
  mobileWidthClass?: string;
  /** Number of cards visible at once at lg+ */
  cardsPerView?: CarouselCardsPerView;
}

export function CarouselTrack<T>({
  emblaRef,
  items,
  itemKey,
  renderItem,
  mobileWidthClass = "w-60",
  cardsPerView = 3,
}: CarouselTrackProps<T>) {
  return (
    <div ref={emblaRef} className="overflow-hidden -mx-[var(--space-page-sm)] lg:mx-0">
      <div className="flex gap-2 pl-[var(--space-page-sm)] lg:pl-0 [&>*:last-child]:mr-[var(--space-page-sm)] lg:[&>*:last-child]:mr-0">
        {items.map((item) => (
          <div
            key={itemKey(item)}
            className={`shrink-0 ${mobileWidthClass} ${desktopWidthClass[cardsPerView]}`}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
