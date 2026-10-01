alter table public.contest_periods alter column gym_id drop not null;

alter table public.contest_periods add column city_id bigint references public.cities(id);

alter table public.contest_periods drop constraint contest_periods_level_check;
alter table public.contest_periods add constraint contest_periods_level_check
  check (level in ('gym', 'city'));

alter table public.contest_periods add constraint contest_periods_level_scope_check
  check (
    (level = 'gym' and gym_id is not null and city_id is null)
    or (level = 'city' and city_id is not null and gym_id is null)
  );
