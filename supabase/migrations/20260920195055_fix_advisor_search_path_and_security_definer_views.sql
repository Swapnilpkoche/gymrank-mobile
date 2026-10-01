-- ============ 1. pin search_path on the four functions flagged by the advisor ============
-- ALTER (not CREATE OR REPLACE) so function bodies, ownership and grants are untouched.
-- Same setting the rest of the project uses (is_gym_admin, is_adult, get_public_profile, ...).
alter function public.checkin_to_gym(bigint, double precision, double precision) set search_path to 'public';
alter function public.is_staff_of_gym(bigint)                                     set search_path to 'public';
alter function public.get_gym_busy_hours(bigint, text)                            set search_path to 'public';
alter function public.moderate_gym_review()                                       set search_path to 'public';

-- ============ 2. replace the two SECURITY DEFINER views ============
-- Flipping them straight to security_invoker would change what users see:
--   * gym_member_counts reads gym_members, whose RLS only exposes a user's own row / their
--     own gym's rows to staff, so everyone else would see 0 or 1 instead of the real count.
--   * gym_price_tiers reads gym_locations, whose RLS hides non-active locations, so a gym
--     with a temporarily-closed primary location would silently drop out of its city tier.
-- So the elevated read moves into explicit SECURITY DEFINER functions (fixed search_path,
-- aggregate/public data only - the pattern this project already uses), and each view becomes
-- a security_invoker wrapper over its function. Same view names, columns and types, so the
-- client is unchanged and results are identical.

create or replace function public.get_gym_member_counts()
returns table (gym_id bigint, active_member_count bigint)
language sql stable security definer set search_path to 'public' as $$
  select gm.gym_id, count(*)
  from public.gym_members gm
  where gm.status = 'active'
  group by gm.gym_id;
$$;

create or replace function public.get_gym_price_tiers()
returns table (gym_id bigint, city_id bigint, lowest_monthly_equivalent numeric, price_tier text)
language sql stable security definer set search_path to 'public' as $$
  with resolved as (
    select g.id as gym_id,
           ci.id as city_id,
           (select min(pp.monthly_equivalent)
              from public.gym_pricing_plans pp
             where pp.gym_id = g.id) as lowest_monthly_equivalent
      from public.gyms g
      left join public.gym_locations gl on gl.gym_id = g.id and gl.is_primary = true
      left join public.localities loc on loc.id = gl.locality_id
      left join public.cities ci on ci.id = loc.city_id
     where g.status = 'active'
  ), tiered as (
    select r.gym_id,
           ntile(3) over (partition by r.city_id order by r.lowest_monthly_equivalent) as tier_number
      from resolved r
     where r.city_id is not null and r.lowest_monthly_equivalent is not null
  )
  select resolved.gym_id,
         resolved.city_id,
         resolved.lowest_monthly_equivalent,
         case tiered.tier_number
           when 1 then 'budget'::text
           when 2 then 'mid'::text
           when 3 then 'premium'::text
           else null::text
         end
    from resolved
    left join tiered on tiered.gym_id = resolved.gym_id;
$$;

-- The views run as the caller, so the caller needs EXECUTE on the functions.
revoke all on function public.get_gym_member_counts() from public;
revoke all on function public.get_gym_price_tiers()   from public;
grant execute on function public.get_gym_member_counts() to anon, authenticated;
grant execute on function public.get_gym_price_tiers()   to anon, authenticated;

create or replace view public.gym_member_counts with (security_invoker = true) as
  select gym_id, active_member_count from public.get_gym_member_counts();

create or replace view public.gym_price_tiers with (security_invoker = true) as
  select gym_id, city_id, lowest_monthly_equivalent, price_tier from public.get_gym_price_tiers();
