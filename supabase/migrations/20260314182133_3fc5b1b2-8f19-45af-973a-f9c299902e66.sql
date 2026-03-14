-- Add missing columns to freights table
ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS estimated_distance double precision NOT NULL DEFAULT 0;