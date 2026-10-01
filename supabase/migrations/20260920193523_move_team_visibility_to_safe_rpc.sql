-- Public, safe-fields-only view of a gym's active team. Replaces direct reads of
-- public.profiles for other users' rows.
create or replace function public.get_gym_team(p_gym_id bigint)
returns table (
  staff_id bigint, staff_user_id uuid, staff_role text, joined_at timestamptz,
  full_name text, username text, avatar_url text, has_trainer_profile boolean)
language sql stable security definer set search_path = public as $$
  select gs.id, gs.user_id, gs.role, gs.joined_at,
         p.full_name, p.username, p.avatar_url,
         exists (select 1 from public.trainer_profiles tp where tp.user_id = gs.user_id)
  from public.gym_staff gs
  left join public.profiles p on p.id = gs.user_id
  where gs.gym_id = p_gym_id
    and gs.status = 'active'
  order by (gs.role = 'owner') desc, gs.joined_at;
$$;

revoke all on function public.get_gym_team(bigint) from public;
grant execute on function public.get_gym_team(bigint) to anon, authenticated;

-- This policy made EVERY column (date_of_birth, phone_number, gender, role, ...)
-- of any active staff member's profile readable by all authenticated users.
-- With Team now served by get_gym_team(), nothing needs it.
drop policy "Active staff profiles are publicly viewable" on public.profiles;
