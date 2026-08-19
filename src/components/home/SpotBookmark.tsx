import BookmarkButton from "@/components/BookmarkButton";
import type { IconButtonVariant } from "@/components/ui/IconButton";
import type { Spot } from "@/types";

/**
 * Convenience wrapper — converts a full Spot to the DraftSpot shape BookmarkButton expects.
 * Home sections are all `feed`; pass `fromUserId` on the sections that can name
 * the person who surfaced the spot, which is what makes the save count as social.
 */
export function SpotBookmark({
  spot,
  variant = "secondary",
  fromUserId,
}: {
  spot: Spot;
  variant?: IconButtonVariant;
  fromUserId?: string | null;
}) {
  return (
    <BookmarkButton
      variant={variant}
      source="feed"
      fromUserId={fromUserId}
      spot={{
        google_place_id: spot.google_place_id,
        name: spot.name,
        address: spot.address,
        photo_url: spot.photo_url,
        rating: spot.rating,
        types: spot.types,
      }}
    />
  );
}
