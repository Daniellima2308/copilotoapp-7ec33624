
-- Add missing columns to vehicles table
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS operation_profile text NOT NULL DEFAULT 'driver_owner',
  ADD COLUMN IF NOT EXISTS driver_bond text NULL,
  ADD COLUMN IF NOT EXISTS default_commission_percent double precision NULL;

-- Ensure the trigger for auto-creating profiles on signup exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
