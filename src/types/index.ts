export interface Spot {
  id: string;
  google_place_id: string;
  name: string;
  address: string;
  photo_url?: string | null;
  rating?: number | null;
  types?: string[] | null;
  city_id?: string | null;
}

export interface PlaylistSpot {
  id: string;
  notes: string | null;
  position: number | null;
  spots: Spot;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  city: string;
  slug: string;
  description?: string | null;
  is_public: boolean;
  cover_photo_url?: string | null;
  created_at: string;
  updated_at: string;
  spot_count?: number;
}

export interface City {
  id: string;
  google_place_id: string;
  display_name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  bio?: string | null;
  instagram_handle?: string | null;
  avatar_url?: string | null;
  city_id?: string | null;
  created_at: string;
}

// API response shape from /api/spots/search
export interface SearchResult {
  spot_id: string;
  name: string;
  address: string;
  photo_url?: string | null;
  rating?: number | null;
  types?: string[] | null;
}

export interface TodaysPick {
  spot: Spot;
  city: string;
  mentionedBy: {
    userId: string;
    playlistName: string;
    username: string;
    avatarUrl: string | null;
    slug: string;
    city: string;
    count: number;
  } | null;
}

// Where a save came from. Powers the north star metric (trusted discoveries),
// so every save surface must declare one — see saved_spots.discovery_source.
export type DiscoverySource =
  | "search"
  | "feed"
  | "own_playlist"
  | "other_playlist"
  | "other_profile"
  | "direct";

// The person whose content surfaced a spot, when there is one. A save with an
// origin user is a "social save"; search and algorithmic feed rows have none.
export interface SaveOrigin {
  source: DiscoverySource;
  fromUserId?: string | null;
}

// A Google Places result before it's been saved to the spots table
export type DraftSpot = Pick<
  Spot,
  "google_place_id" | "name" | "address" | "photo_url" | "rating" | "types"
> & { notes?: string };
