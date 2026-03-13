alter table public.vehicles
  add column if not exists operation_profile text not null default 'driver_owner',
  add column if not exists driver_bond text,
  add column if not exists default_commission_percent double precision;

alter table public.vehicles
  add constraint vehicles_operation_profile_check
  check (operation_profile in ('driver_owner', 'commissioned_driver', 'owner_with_driver', 'custom'));

alter table public.vehicles
  add constraint vehicles_driver_bond_check
  check (driver_bond is null or driver_bond in ('autonomo', 'clt', 'agregado', 'outro'));

alter table public.vehicles
  add constraint vehicles_default_commission_percent_check
  check (default_commission_percent is null or (default_commission_percent >= 0 and default_commission_percent <= 100));
