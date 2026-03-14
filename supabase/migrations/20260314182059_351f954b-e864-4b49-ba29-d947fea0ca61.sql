-- Add missing columns to vehicles table (if not already present)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS operation_profile text NOT NULL DEFAULT 'driver_owner',
  ADD COLUMN IF NOT EXISTS driver_bond text NULL,
  ADD COLUMN IF NOT EXISTS default_commission_percent double precision NULL;