-- Revert the overly-broad row policy - column grants aren't row-conditional,
-- so widening the row policy accidentally exposed role/is_verified/follow_limit/etc
-- on EVERY user's row, not just the intended public fields.
drop policy "Any authenticated user can view basic public profile fields" on public.profiles;

-- Revoke the column grant added alongside it (redundant now, and was too permissive in combination)
revoke select (id, full_name, username, avatar_url, bio) on public.profiles from authenticated;

-- Clean, safe approach: a SECURITY DEFINER function returning ONLY the safe public fields
-- for any user, regardless of RLS - this is the same safe pattern used for get_location_stats.
create or replace function public.get_public_profile(p_user_id uuid)
returns table(id uuid, full_name text, username text, avatar_url text, bio text)
language sql
security definer
set search_path = public
stable
as $function$
  select p.id, p.full_name, p.username, p.avatar_url, p.bio
  from public.profiles p
  where p.id = p_user_id;
$function$;

grant execute on function public.get_public_profile(uuid) to authenticated;
