-- =====================================================================
-- Migration: gym_controls
-- Project:   gymrank-india (htzngffthxcnshmytgsm)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New columns on gyms. All default true so every live gym keeps
--    today's behaviour.
-- ---------------------------------------------------------------------
alter table public.gyms
  add column is_discoverable            boolean not null default true,
  add column accepting_join_requests    boolean not null default true,
  add column accepting_trainer_requests boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. gym_members INSERT policy
--
-- OLD (live now, from pg_policies):
--   policy "Users can request to join a gym as a member" on public.gym_members
--   FOR INSERT TO authenticated
--   WITH CHECK ((user_id = auth.uid()) AND (status = 'pending'::text))
--
-- NEW: same two conditions + the gym must be accepting join requests.
--      The gyms subquery runs under the requester's own gyms RLS, so it
--      also rejects requests to gyms they can't see (non-active gyms).
-- ---------------------------------------------------------------------
alter policy "Users can request to join a gym as a member" on public.gym_members
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.gyms g
      where g.id = gym_members.gym_id
        and g.accepting_join_requests
    )
  );

-- ---------------------------------------------------------------------
-- 3. gym_staff INSERT policy (trainer requests)
--
-- OLD (live now, from pg_policies):
--   policy "Adult trainers can request to join a gym" on public.gym_staff
--   FOR INSERT TO authenticated
--   WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)
--     AND (role = 'trainer'::text) AND (invited_by IS NULL) AND (responded_by IS NULL)
--     AND (responded_at IS NULL) AND is_adult(( SELECT auth.uid() AS uid))
--     AND (EXISTS ( SELECT 1
--        FROM trainer_profiles tp
--       WHERE (tp.user_id = ( SELECT auth.uid() AS uid)))))
--
-- NEW: every existing condition kept + the gym must be accepting
--      trainer requests.
-- ---------------------------------------------------------------------
alter policy "Adult trainers can request to join a gym" on public.gym_staff
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and role = 'trainer'
    and invited_by is null
    and responded_by is null
    and responded_at is null
    and public.is_adult((select auth.uid()))
    and exists (select 1 from public.trainer_profiles tp where tp.user_id = (select auth.uid()))
    and exists (
      select 1 from public.gyms g
      where g.id = gym_staff.gym_id
        and g.accepting_trainer_requests
    )
  );

-- ---------------------------------------------------------------------
-- 4. search_gyms: hidden gyms never appear in search.
--    Identical to the live definition except the "and g.is_discoverable"
--    line. Same signature, so existing grants are preserved.
-- ---------------------------------------------------------------------
create or replace function public.search_gyms(search_term text)
 returns table(id bigint, name text, slug text, description text, status text, verification_status text, location text, city text, state text, country text, category text, latitude double precision, longitude double precision)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    g.id,
    g.name,
    g.slug,
    g.description,
    g.status,
    g.verification_status,
    g.location,
    coalesce(ci.name, g.city) as city,
    coalesce(st.name, g.state) as state,
    coalesce(co.name, g.country) as country,
    g.category,
    g.latitude,
    g.longitude
  from public.gyms g
  left join public.gym_locations gl on gl.gym_id = g.id and gl.is_primary
  left join public.localities loc on loc.id = gl.locality_id
  left join public.cities ci on ci.id = loc.city_id
  left join public.states st on st.id = ci.state_id
  left join public.countries co on co.id = st.country_id
  where g.status = 'active'
    and g.is_discoverable
    and (
      g.name ilike '%' || search_term || '%'
      or g.location ilike '%' || search_term || '%'
      or g.city ilike '%' || search_term || '%'
      or g.state ilike '%' || search_term || '%'
      or g.country ilike '%' || search_term || '%'
      or loc.name ilike '%' || search_term || '%'
      or ci.name ilike '%' || search_term || '%'
      or st.name ilike '%' || search_term || '%'
      or co.name ilike '%' || search_term || '%'
    )
  order by g.name
  limit 20;
$function$;

-- ---------------------------------------------------------------------
-- 5. get_public_owned_gyms: hidden gyms are left off a public profile,
--    except when the owner is viewing their own profile.
--    Identical to the live definition except the last WHERE line.
-- ---------------------------------------------------------------------
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
  order by g.name;
$function$;

-- ---------------------------------------------------------------------
-- 6. set_gym_controls (called from the app as setGymControls).
--    Only an active owner/admin of the gym (is_gym_admin) may change the
--    three controls. NULL for a parameter = leave that setting unchanged.
--    gyms has no UPDATE policy, so this is the only way to change them.
-- ---------------------------------------------------------------------
create or replace function public.set_gym_controls(
  p_gym_id bigint,
  p_is_discoverable boolean default null,
  p_accepting_join_requests boolean default null,
  p_accepting_trainer_requests boolean default null
)
 returns table(gym_id bigint, is_discoverable boolean, accepting_join_requests boolean, accepting_trainer_requests boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if not public.is_gym_admin(p_gym_id) then
    raise exception 'Only an active owner or admin of this gym can change its controls.'
      using errcode = '42501';
  end if;

  return query
  update public.gyms g
     set is_discoverable            = coalesce(p_is_discoverable, g.is_discoverable),
         accepting_join_requests    = coalesce(p_accepting_join_requests, g.accepting_join_requests),
         accepting_trainer_requests = coalesce(p_accepting_trainer_requests, g.accepting_trainer_requests),
         updated_at                 = now()
   where g.id = p_gym_id
  returning g.id, g.is_discoverable, g.accepting_join_requests, g.accepting_trainer_requests;
end;
$function$;

revoke all on function public.set_gym_controls(bigint, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_gym_controls(bigint, boolean, boolean, boolean) to authenticated;
