-- 1. New columns
alter table public.profiles
  add column date_of_birth date,
  add column dob_edit_count integer not null default 0;

-- 2. is_adult() helper - defense-in-depth boolean, false for missing profile
-- or missing date_of_birth (never null, so callers can use it directly in a
-- WHERE/if without an extra null check).
create or replace function public.is_adult(profile_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(
    (
      select extract(year from age(current_date, p.date_of_birth)) >= 18
      from public.profiles p
      where p.id = profile_id
    ),
    false
  );
$function$;

grant execute on function public.is_adult(uuid) to anon, authenticated;

-- 3. Minimum signup age of 16, enforced where the profile row is first
-- created. date_of_birth is optional at this layer (existing users predate
-- this column and get a one-time prompt instead) - only the age-16 floor is
-- a hard rule, checked only when a DOB is actually supplied.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dob date;
begin
  v_dob := nullif(new.raw_user_meta_data->>'date_of_birth', '')::date;

  if v_dob is not null and extract(year from age(current_date, v_dob)) < 16 then
    raise exception 'You must be at least 16 years old to create a GymTrust account.';
  end if;

  insert into public.profiles (id, full_name, date_of_birth)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_dob
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- 4. Edit-limit: the first-ever entry (null -> a value, e.g. the existing-user
-- backfill prompt) is free and doesn't count: it isn't a "change", it's
-- supplying missing data, same as setting it at signup. Only an already-set
-- date_of_birth being modified (including cleared) counts against the cap
-- of 2, matching the trg_enforce_*_limits pattern used elsewhere.
create or replace function public.enforce_dob_edit_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.date_of_birth is not null and new.date_of_birth is distinct from old.date_of_birth then
    if old.dob_edit_count >= 2 then
      raise exception 'Date of birth is now permanently locked after 2 changes. To change it further, you would need to delete and recreate your account.';
    end if;
    new.dob_edit_count := old.dob_edit_count + 1;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_enforce_dob_edit_limit on public.profiles;
create trigger trg_enforce_dob_edit_limit
  before update on public.profiles
  for each row
  execute function public.enforce_dob_edit_limit();
