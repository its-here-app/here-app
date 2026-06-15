import BookmarkButton from "@/components/BookmarkButton";
import type { Spot } from "@/types";

/** Convenience wrapper — converts a full Spot to the DraftSpot shape BookmarkButton expects. */
export function SpotBookmark({ spot }: { spot: Spot }) {
  return (
    <BookmarkButton
      variant="secondary"
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
