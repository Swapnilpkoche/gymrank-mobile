-- Guests (anon) can view public profiles again, but never a minor's.
-- "Minor" is is_adult() = false, the same definition messaging uses - which
-- also treats a missing date_of_birth as not adult, so those stay hidden too.
-- Signed-in users are unaffected (auth.uid() is not null).

-- 1. search_profiles: a guest never sees a minor in results.
create or replace function public.search_profiles(p_query text)
returns table(id uuid, full_name text, username text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $function$
  select p.id, p.full_name, p.username, p.avatar_url
  from public.profiles p
  where (p.full_name ilike '%' || p_query || '%'
      or p.username ilike '%' || p_query || '%')
    and (auth.uid() is not null or public.is_adult(p.id))
  order by p.full_name
  limit 20;
$function$;

-- 2. get_public_profile: no row for a minor when called by a guest, so the
-- app shows "not available".
create or replace function public.get_public_profile(p_user_id uuid)
returns table(id uuid, full_name text, username text, avatar_url text, bio text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.id, p.full_name, p.username, p.avatar_url, p.bio
  from public.profiles p
  where p.id = p_user_id
    and (auth.uid() is not null or public.is_adult(p.id));
$function$;

-- 3. get_public_owned_gyms: same filter, so a guest can't link a minor to
-- the gyms they own.
create or replace function public.get_public_owned_gyms(p_user_id uuid)
returns table(gym_id bigint, name text, city text, avg_rating numeric, review_count bigint, member_count bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select g.id, g.name,
         coalesce(c.name, g.city),
         case when st.total_reviews > 0 then round(st.avg_rating, 1) end,
         coalesce(st.total_reviews, 0),
         coalesce(mc.active_member_count, 0)
  from public.gym_staff gs
  join public.gyms g on g.id = gs.gym_id and g.status = 'active'
  left join lateral (
    select gl.id, gl.locality_id from public.gym_locations gl
    where gl.gym_id = g.id order by gl.is_primary desc, gl.id limit 1
  ) loc on true
  left join public.localities l on l.id = loc.locality_id
  left join public.cities c on c.id = l.city_id
  left join lateral public.get_location_stats(loc.id) st on loc.id is not null
  left join public.get_gym_member_counts() mc on mc.gym_id = g.id
  where gs.user_id = p_user_id and gs.role = 'owner' and gs.status = 'active'
    and (g.is_discoverable or p_user_id = auth.uid())
    and (auth.uid() is not null or public.is_adult(p_user_id))
  order by g.name;
$function$;

-- 4. Reopen guest access. search_profiles previously reached anon only via
-- the PUBLIC default grant - make it explicit like search_gyms.
grant execute on function public.get_public_profile(uuid) to anon;
grant execute on function public.get_public_owned_gyms(uuid) to anon;
grant execute on function public.search_profiles(text) to anon;
