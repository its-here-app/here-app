import BookmarkButton from "@/components/BookmarkButton";
import type { IconButtonVariant } from "@/components/ui/IconButton";
import type { Spot } from "@/types";

/** Convenience wrapper — converts a full Spot to the DraftSpot shape BookmarkButton expects. */
export function SpotBookmark({ spot, variant = "secondary" }: { spot: Spot; variant?: IconButtonVariant }) {
  return (
    <BookmarkButton
      variant={variant}
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
