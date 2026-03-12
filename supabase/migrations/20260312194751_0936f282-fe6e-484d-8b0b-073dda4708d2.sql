
-- 1. Add DELETE policy on profiles
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Create RPC for atomic like increment/decrement
CREATE OR REPLACE FUNCTION public.increment_post_likes(post_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE mural_posts
  SET likes = GREATEST(0, likes + amount)
  WHERE id = post_id;
END;
$$;
