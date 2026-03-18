CREATE TABLE public.route_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  origin_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  origin_normalized TEXT NOT NULL,
  destination_normalized TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  origin_lat NUMERIC,
  origin_lon NUMERIC,
  destination_lat NUMERIC,
  destination_lon NUMERIC,
  provider TEXT NOT NULL DEFAULT 'tomtom',
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, origin_normalized, destination_normalized)
);

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own route cache"
  ON public.route_cache
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);