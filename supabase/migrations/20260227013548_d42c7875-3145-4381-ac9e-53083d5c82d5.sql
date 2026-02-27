
-- Add personal_expenses_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_expenses_enabled boolean NOT NULL DEFAULT false;

-- Create personal_expenses table
CREATE TABLE IF NOT EXISTS public.personal_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  value double precision NOT NULL DEFAULT 0,
  date text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal_expenses" ON public.personal_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own personal_expenses" ON public.personal_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personal_expenses" ON public.personal_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own personal_expenses" ON public.personal_expenses FOR DELETE USING (auth.uid() = user_id);

-- Add receipt_url columns
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url text DEFAULT NULL;
ALTER TABLE public.fuelings ADD COLUMN IF NOT EXISTS receipt_url text DEFAULT NULL;

-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true) ON CONFLICT (id) DO NOTHING;

-- RLS for receipts bucket
CREATE POLICY "Users can upload receipts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own receipts" ON storage.objects FOR DELETE USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public can view receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
