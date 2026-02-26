
-- Add current_km to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS current_km double precision NOT NULL DEFAULT 0;

-- Create maintenance_services table
CREATE TABLE public.maintenance_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  last_change_km double precision NOT NULL DEFAULT 0,
  interval_km double precision NOT NULL DEFAULT 10000,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_services ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own maintenance_services" ON public.maintenance_services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own maintenance_services" ON public.maintenance_services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own maintenance_services" ON public.maintenance_services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own maintenance_services" ON public.maintenance_services FOR DELETE USING (auth.uid() = user_id);
