"use client";

import { useState, type ReactNode } from "react";
import type { Spot } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Rating } from "@/components/ui/Rating";

const FILTERED_TYPES = new Set(["point_of_interest", "establishment"]);

export type SpotCardSize = "default" | "xxsmall";

interface SpotCardProps {
  spot: Pick<
    Spot,
    "google_place_id" | "name" | "address" | "photo_url" | "rating" | "types"
  >;
  size?: SpotCardSize;
  subtitleText?: string;
  action?: React.ReactNode;
  bookmark?: React.ReactNode;
  className?: string;
  disableLink?: boolean;
  onClick?: () => void;
  subtitleSlot?: ReactNode;
  city?: string;
}

export default function SpotCard({
  spot,
  size = "default",
  subtitleText,
  action,
  bookmark,
  className,
  disableLink = false,
  onClick,
  subtitleSlot,
  city,
}: SpotCardProps) {
  const isXxsmall = size === "xxsmall";
  const firstType = spot.types
    ?.filter((t) => !FILTERED_TYPES.has(t))
    .map((t) => t.replace(/_/g, " "))[0];

  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${spot.google_place_id}`;

  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!spot.photo_url && !imgFailed;
  const thumbnailClass = isXxsmall ? "size-[3.125rem]" : "w-20 h-20";

  return (
    <div className={`flex items-start gap-2 ${className ?? ""}`}>
      {disableLink ? (
        <div
          className={`flex items-start gap-2 flex-1 min-w-0 ${onClick ? "cursor-pointer" : ""}`}
          onClick={onClick}
        >
          <div className={`flex-shrink-0 ${thumbnailClass} rounded-xs overflow-hidden bg-grey-300`}>
            {showImage && (
              <img
                src={spot.photo_url!}
                alt={spot.name}
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-header-radio-2 lg:text-header-radio-1 mb-[2px]">{spot.name}</p>
            {subtitleSlot ?? (
              <p className="text-body-xs text-secondary mb-1 line-clamp-1">
                {subtitleText ?? spot.address}
              </p>
            )}
            {!isXxsmall && (spot.rating != null || firstType || city) && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {firstType && <Badge>{firstType}</Badge>}
                {spot.rating != null && <Rating rating={spot.rating} />}
                {spot.rating != null && city && (
                  <span className="text-body-xs text-secondary">·</span>
                )}
                {city && (
                  <span className="text-body-xs text-secondary">{city}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer group"
        >
          <div className={`flex-shrink-0 ${thumbnailClass} rounded-xs overflow-hidden bg-grey-300 transition-transform duration-400 ease-out group-hover:scale-100`}>
            {showImage && (
              <img
                src={spot.photo_url!}
                alt={spot.name}
                className="w-full h-full object-cover"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-header-radio-2 lg:text-header-radio-1 mb-[2px]">{spot.name}</p>
            {subtitleSlot ?? (
              <p className="text-body-xs text-secondary mb-1 line-clamp-1">
                {subtitleText ?? spot.address}
              </p>
            )}
            {!isXxsmall && (spot.rating != null || firstType || city) && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {firstType && <Badge>{firstType}</Badge>}
                {spot.rating != null && <Rating rating={spot.rating} />}
                {spot.rating != null && city && (
                  <span className="text-body-xs text-secondary">·</span>
                )}
                {city && (
                  <span className="text-body-xs text-secondary">{city}</span>
                )}
              </div>
            )}
          </div>
        </a>
      )}
      {(bookmark || action) && (
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          {bookmark}
          {action}
        </div>
      )}
    </div>
  );
}
