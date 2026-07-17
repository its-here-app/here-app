-- Reformat Australian cities.display_name from "City ST, Australia" (state
-- jammed into the city segment, exactly how Google Places returns AU
-- localities) to "City, ST, Australia" -- a proper 3-part comma format
-- matching the existing Canada convention (e.g. "Cambridge, ON, Canada").
--
-- Same row ids throughout (pure text edit), so no FK updates needed for
-- spots/playlists/profiles already referencing these cities. Display
-- truncation (formatCityDisplay) still shows just the bare city name
-- wherever is_primary is set, e.g. "Sydney" -- this only fixes the
-- underlying data so state stays available to disambiguate real,
-- distinct same-named towns (Woodside SA vs VIC, Shelly Beach NSW vs
-- QLD, Inglewood QLD/VIC/WA, Pimlico QLD/NSW) instead of colliding them.
--
-- src/lib/cityResolution.ts (extractAustralia) and
-- src/lib/services/cities.ts (resolveCityIdFromAddress) were updated in
-- the same change to parse/match this new 3-part format going forward.
-- Safe to run more than once.

UPDATE cities AS c
SET display_name = v.display_name
FROM (VALUES
  ('4afdc3d3-f723-4886-8421-fc27e920e549'::uuid, 'Sydney, NSW, Australia'),
  ('76572b78-ba25-42c9-81eb-c608ca4d851d'::uuid, 'Toronto, NSW, Australia'),
  ('355f4604-2109-4c0b-8c7d-ed348a302d04'::uuid, 'Margate, QLD, Australia'),
  ('28d5bed4-a491-4272-b087-1624d7c61962'::uuid, 'Woodside, SA, Australia'),
  ('2fc30fd1-13fa-4f1f-b8f1-21f1e924076f'::uuid, 'Brighton, VIC, Australia'),
  ('29ff8661-08f6-4281-bb90-af94aacc85c3'::uuid, 'Woodside, VIC, Australia'),
  ('52fd9cb7-ab3e-4921-8829-4a23619cffed'::uuid, 'Pasadena, SA, Australia'),
  ('7d5e5100-9553-4a5a-bee6-50857fe18595'::uuid, 'Shelly Beach, NSW, Australia'),
  ('e579d347-9e3e-4b89-9db3-cd83cccd768e'::uuid, 'Shelly Beach, QLD, Australia'),
  ('6ef1b738-7bfc-4a6d-bacc-c6009d6bdb5c'::uuid, 'Beverly Hills, NSW, Australia'),
  ('5f77208f-2f33-4f37-84e7-b563c885fefa'::uuid, 'Ridgewood, WA, Australia'),
  ('327d0ab7-cfee-4c31-af81-7f4b3dc26ad6'::uuid, 'Blue Mountains, NSW, Australia'),
  ('73b6fcb3-44ae-4c79-aed0-49987b310e68'::uuid, 'Bondi Beach, NSW, Australia'),
  ('8c2e7c71-52e3-445b-80d3-a3c2b28217e8'::uuid, 'Denmark, WA, Australia'),
  ('9eadd520-a601-4054-8e29-e49dffae802e'::uuid, 'Inglewood, QLD, Australia'),
  ('a6ee0b76-bb28-4883-9a16-1667465334f1'::uuid, 'Inglewood, VIC, Australia'),
  ('a1b81370-40ab-48d0-99dd-91dbbc3b1cf0'::uuid, 'Inglewood, WA, Australia'),
  ('34961006-3d7f-47ec-9771-97b8e6949f67'::uuid, 'Chiswick, NSW, Australia'),
  ('6a160ccb-c49b-4eae-b058-1e10a37195f2'::uuid, 'Pimlico, QLD, Australia'),
  ('2d173cc7-bcd0-49fe-b5b6-5bd374fd99d6'::uuid, 'Pimlico, NSW, Australia'),
  ('c1a4a7ec-3782-4627-bdd9-a4d4b73b1784'::uuid, 'Mentone, VIC, Australia'),
  ('847d09e3-4241-4129-81be-993042d3f834'::uuid, 'Crawley, WA, Australia'),
  ('216aaf38-ed32-4ffe-81bd-cfa6a118ae7d'::uuid, 'Summerlands, VIC, Australia'),
  ('aeeda541-1bd1-4c74-a5d5-6e5b870cc7a8'::uuid, 'Paddington, NSW, Australia'),
  ('e64868cc-4f47-4dff-97b4-4d090a948242'::uuid, 'The Rock, NSW, Australia'),
  ('6f851694-8770-49db-9eaf-ecf69e4ea1bf'::uuid, 'Alexandria, NSW, Australia'),
  ('aa48b4e4-ead2-4f93-95f5-bc30ade6becd'::uuid, 'Manly, NSW, Australia'),
  ('9a04f61b-ce3a-4ca8-b390-320eb219b761'::uuid, 'Millers Point, NSW, Australia'),
  ('98c59439-79d5-46de-88fe-d52acb94bdda'::uuid, 'Newtown, NSW, Australia'),
  ('beaee77e-d4df-448b-adff-b64b71643cbd'::uuid, 'Haymarket, NSW, Australia'),
  ('af0ee704-35ef-463f-8e5c-d79fb7a4a51b'::uuid, 'Dover Heights, NSW, Australia'),
  ('89206d86-fc1c-4e40-845d-ae6e278d5759'::uuid, 'Melbourne, VIC, Australia'),
  ('747e902d-52e4-460f-8fa6-d9fa93988c1f'::uuid, 'Stanmore, NSW, Australia'),
  ('2f4a0223-fcda-41d6-8254-ee7ab7e9a471'::uuid, 'Ryde, NSW, Australia'),
  ('744182ea-766e-4868-a818-f98a6531511c'::uuid, 'Redfern, NSW, Australia'),
  ('fdbbceff-d358-4834-8063-c7f910a94ef5'::uuid, 'Darlinghurst, NSW, Australia'),
  ('3f95abe1-0591-40aa-8f27-e07cdac377d1'::uuid, 'Marrickville, NSW, Australia'),
  ('0ef05c70-f336-4c97-a267-47064e0ee10a'::uuid, 'Surry Hills, NSW, Australia'),
  ('804100e5-822f-4d6f-b91a-cef0f001c997'::uuid, 'The Rocks, NSW, Australia'),
  ('b865efaf-63af-45cf-be4b-5e8f25198709'::uuid, 'North Bondi, NSW, Australia'),
  ('21fe60ed-a39f-44a3-b111-59cda651ce09'::uuid, 'Glebe, NSW, Australia'),
  ('ac4a411f-2149-40ba-aabb-713c4dea1eac'::uuid, 'Rosebery, NSW, Australia'),
  ('0eba3225-9d7b-4ce7-b0f3-c62e7ff23b86'::uuid, 'Pomona, QLD, Australia')
) AS v(id, display_name)
WHERE c.id = v.id;
