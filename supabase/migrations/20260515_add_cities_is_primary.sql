-- Add is_primary flag to cities.
-- Indicates whether this is the most well-known city for its base name
-- (e.g. Portland OR is primary, Portland ME is not).
-- Set on-the-fly via autocomplete selection (self-healing).
ALTER TABLE cities ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Backfill: cities with a unique base name are automatically primary.
WITH base_counts AS (
  SELECT
    id,
    lower(trim(split_part(display_name, ',', 1))) AS base_name,
    COUNT(*) OVER (
      PARTITION BY lower(trim(split_part(display_name, ',', 1)))
    ) AS name_count
  FROM cities
)
UPDATE cities
SET is_primary = true
FROM base_counts bc
WHERE cities.id = bc.id
  AND bc.name_count = 1;
