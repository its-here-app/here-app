-- Delete city coordinates sourced from the Google Places API.
--
-- `cities.latitude` / `cities.longitude` were populated by
-- `upsertCityAction()` calling Place Details with `fields=geometry`, then kept
-- forever — the action is guarded by `if (!existing?.latitude)`, so a city's
-- coordinates were fetched once and never refreshed.
--
-- That is indefinite storage of Places latitude/longitude, which the Google
-- Maps Platform Service Specific Terms §14.3 explicitly cap:
--
--   "Customer may temporarily cache latitude and longitude values from the
--    Places API for up to 30 consecutive calendar days, after which Customer
--    must delete the cached latitude and longitude values."
--
-- Every existing value is well past 30 days, so all of them are cleared. This
-- includes the two rows seeded literally in 20260705000002 (Seattle, Salt Lake
-- City) — that migration's own comment records the coordinates as "verified
-- via the Places API", so they are Places Content too regardless of arriving
-- through SQL rather than at runtime.
--
-- Coordinates now come from Open-Meteo's geocoding API instead (see
-- src/lib/geocodeCity.ts), which carries no caching restriction. Cleared rows
-- refill on demand the first time api/weather needs them, so the only visible
-- effect is one geocode call per city, once.

UPDATE cities
   SET latitude = NULL,
       longitude = NULL
 WHERE latitude IS NOT NULL
    OR longitude IS NOT NULL;

COMMENT ON COLUMN cities.latitude IS
  'Geocoded from display_name via Open-Meteo. NOT Places Content — do not repopulate from the Google Places API, which would reimpose the 30-day deletion rule in Maps Platform Service Specific Terms 14.3.';
COMMENT ON COLUMN cities.longitude IS
  'Geocoded from display_name via Open-Meteo. See the note on cities.latitude.';
