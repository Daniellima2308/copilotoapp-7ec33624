
ALTER TABLE public.expenses ADD COLUMN source_fueling_id uuid REFERENCES public.fuelings(id) ON DELETE CASCADE DEFAULT NULL;
