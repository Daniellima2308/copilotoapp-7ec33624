CREATE TABLE IF NOT EXISTS public.route_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  origin_normalized TEXT NOT NULL,
  destination_normalized TEXT NOT NULL,
  distance_km DOUBLE PRECISION NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lon DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lon DOUBLE PRECISION NOT NULL,
  provider TEXT NOT NULL DEFAULT 'tomtom',
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT route_cache_directional_unique UNIQUE (user_id, origin_normalized, destination_normalized)
);

CREATE INDEX IF NOT EXISTS route_cache_lookup_idx
  ON public.route_cache (user_id, origin_normalized, destination_normalized);

ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'route_cache'
      AND policyname = 'Users can view own route cache'
  ) THEN
    CREATE POLICY "Users can view own route cache" ON public.route_cache
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'route_cache'
      AND policyname = 'Users can insert own route cache'
  ) THEN
    CREATE POLICY "Users can insert own route cache" ON public.route_cache
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'route_cache'
      AND policyname = 'Users can update own route cache'
  ) THEN
    CREATE POLICY "Users can update own route cache" ON public.route_cache
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_route_cache_updated_at'
  ) THEN
    CREATE TRIGGER update_route_cache_updated_at
      BEFORE UPDATE ON public.route_cache
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
