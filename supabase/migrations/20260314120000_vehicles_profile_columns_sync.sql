-- Ensure vehicles has the new operation fields used by the app and refresh PostgREST schema cache.
alter table public.vehicles
  add column if not exists operation_profile text,
  add column if not exists driver_bond text,
  add column if not exists default_commission_percent double precision;

update public.vehicles
set operation_profile = 'driver_owner'
where operation_profile is null;

alter table public.vehicles
  alter column operation_profile set default 'driver_owner',
  alter column operation_profile set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_operation_profile_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_operation_profile_check
      check (operation_profile in ('driver_owner', 'commissioned_driver', 'owner_with_driver', 'custom'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_driver_bond_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_driver_bond_check
      check (driver_bond is null or driver_bond in ('autonomo', 'clt', 'agregado', 'outro'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_default_commission_percent_check'
      and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_default_commission_percent_check
      check (default_commission_percent is null or (default_commission_percent >= 0 and default_commission_percent <= 100));
  end if;
end
$$;

notify pgrst, 'reload schema';
