
-- Canais PX
CREATE TABLE public.px_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private')),
  creator_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.px_channels ENABLE ROW LEVEL SECURITY;

-- Public channels readable by all authenticated users
CREATE POLICY "Anyone can read public channels" ON public.px_channels
  FOR SELECT USING (type = 'public' OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can read private channels" ON public.px_channels
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create channels" ON public.px_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can delete own channels" ON public.px_channels
  FOR DELETE USING (auth.uid() = creator_id);

-- Mensagens PX
CREATE TABLE public.px_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.px_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Motorista',
  text TEXT,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.px_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read messages" ON public.px_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own messages" ON public.px_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.px_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.px_messages;

-- Mural posts
CREATE TABLE public.mural_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Motorista',
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read posts" ON public.mural_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own posts" ON public.mural_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON public.mural_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can update likes" ON public.mural_posts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own posts" ON public.mural_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Mural likes tracking
CREATE TABLE public.mural_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.mural_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read likes" ON public.mural_likes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own likes" ON public.mural_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.mural_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for PX audio and mural images
INSERT INTO storage.buckets (id, name, public) VALUES ('px-media', 'px-media', true);

-- Storage policies for px-media
CREATE POLICY "Anyone can read px-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'px-media');

CREATE POLICY "Authenticated users can upload px-media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'px-media' AND auth.uid() IS NOT NULL);

-- Seed public channels
INSERT INTO public.px_channels (name, type) VALUES
  ('CH Geral', 'public'),
  ('Dutra (BR-116)', 'public'),
  ('Régis Bittencourt (BR-116)', 'public'),
  ('Rio-Bahia (BR-116)', 'public'),
  ('Planalto Sul (BR-116)', 'public'),
  ('Fernão Dias (BR-381)', 'public'),
  ('Transbrasiliana (BR-153)', 'public'),
  ('Rota da Soja (BR-163)', 'public'),
  ('Litorânea (BR-101)', 'public'),
  ('BR-040', 'public'),
  ('BR-277 (PR)', 'public'),
  ('Anhanguera/Bandeirantes', 'public');
