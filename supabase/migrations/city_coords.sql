-- Create a cache table for geocoded city coordinates.
-- Populated by the backfill script and the live-geocode fallback in orders-locations.js.
CREATE TABLE IF NOT EXISTS city_coords (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  city text NOT NULL,
  country text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (city, country)
);

ALTER TABLE city_coords ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read (used by the customer map on the frontend)
CREATE POLICY "Anyone can read city_coords"
  ON city_coords FOR SELECT
  USING (true);

-- Allow service_role to insert/update (used by the backfill script and Express route)
CREATE POLICY "Service role can write city_coords"
  ON city_coords FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
