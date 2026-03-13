ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS estimated_distance DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'freights_status_check'
  ) THEN
    ALTER TABLE public.freights
      ADD CONSTRAINT freights_status_check
      CHECK (status IN ('planned', 'in_progress', 'completed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS freights_single_in_progress_per_trip_idx
  ON public.freights (trip_id)
  WHERE status = 'in_progress';

WITH ranked AS (
  SELECT
    id,
    trip_id,
    ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY created_at ASC) AS freight_position,
    COUNT(*) OVER (PARTITION BY trip_id) AS freight_count
  FROM public.freights
)
UPDATE public.freights AS f
SET status = CASE
  WHEN ranked.freight_count = 1 THEN 'in_progress'
  WHEN ranked.freight_position = 1 THEN 'in_progress'
  ELSE 'planned'
END
FROM ranked
WHERE ranked.id = f.id;
