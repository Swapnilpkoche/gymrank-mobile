-- 1. New companion RPC: public, safe summary of the gyms a user actively owns.
create function public.get_public_owned_gyms(p_user_id uuid)
returns table(gym_id bigint, name text, city text, avg_rating numeric, review_count bigint, member_count bigint)
language sql stable security definer set search_path to 'public'
as $$
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
  order by g.name;
$$;

revoke all on function public.get_public_owned_gyms(uuid) from public, anon;
grant execute on function public.get_public_owned_gyms(uuid) to authenticated;

-- 2. Close the existing gap: get_public_profile was executable by PUBLIC (so anon).
revoke execute on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
