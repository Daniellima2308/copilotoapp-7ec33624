
-- Add category and region columns to px_channels
ALTER TABLE public.px_channels ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'global';
ALTER TABLE public.px_channels ADD COLUMN IF NOT EXISTS region text;

-- Delete existing public channels to re-seed
DELETE FROM public.px_channels WHERE type = 'public';
