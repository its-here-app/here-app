-- Backfill playlists.city_id for playlists created before city selection was
-- standardized via the Google Places picker (they only have the free-text
-- `city` column set). Two parts:
--
-- 1. Insert `cities` rows for cities that show up in old playlists but have
--    no matching row yet (place_id/coordinates verified via the Places API).
-- 2. Match every playlist with a null city_id against `cities.display_name`,
--    comparing only the part before the first comma (so "Oakland" matches
--    "Oakland, CA"), case-insensitively. Safe to run more than once.

INSERT INTO cities (google_place_id, display_name, is_primary, latitude, longitude)
VALUES
  ('ChIJVTPokywQkFQRmtVEaUZlJRA', 'Seattle, WA', true, 47.6061389, -122.3328481),
  ('ChIJ7THRiJQ9UocRyjFNSKC3U1s', 'Salt Lake City, UT', true, 40.7605601, -111.8881397)
ON CONFLICT (google_place_id) DO NOTHING;

UPDATE playlists
SET city_id = cities.id
FROM cities
WHERE playlists.city_id IS NULL
  AND lower(split_part(playlists.city, ',', 1)) = lower(split_part(cities.display_name, ',', 1));
