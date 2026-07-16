-- Add city_id to spots so spots can be recommended by city.
-- Mirrors the city_id pattern already used on profiles/playlists (see
-- 20260401_add_cities.sql).
ALTER TABLE spots ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id);

CREATE INDEX IF NOT EXISTS idx_spots_city_id ON spots(city_id);
