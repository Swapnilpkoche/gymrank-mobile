-- ============ 1. Close the check-in forgery path ============
-- gym_checkins had an INSERT policy of just (auth.uid() = user_id), so any signed-in user could
-- insert their own row directly with is_valid = true, any gym, any coordinates - skipping the
-- 150 m check in checkin_to_gym(). A "verified visit" derived from that table would be forgeable
-- with one extra request. The app only ever writes check-ins through the checkin_to_gym() RPC
-- (SECURITY DEFINER, so it doesn't need this policy or these grants).
drop policy "Users can insert their own checkins" on public.gym_checkins;
revoke insert, update, delete on public.gym_checkins from anon, authenticated;

-- ============ 2. is_verified_visit is computed by the server, never supplied ============
-- Single definition of "verified": the reviewer has at least one VALID check-in at that gym.
create or replace function public.compute_gym_review_verified_visit(p_user_id uuid, p_gym_id bigint)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
      from public.gym_checkins c
     where c.user_id = p_user_id
       and c.gym_id  = p_gym_id
       and c.is_valid = true
  );
$$;

create or replace function public.set_gym_review_verified_visit()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  -- Whatever the caller sent for is_verified_visit is discarded.
  new.is_verified_visit := public.compute_gym_review_verified_visit(new.user_id, new.gym_id);
  return new;
end; $$;

-- Neither is meant to be callable through /rest/v1/rpc (the helper would otherwise leak
-- "did user X check in at gym Y"). Triggers don't need EXECUTE for the invoking role.
revoke execute on function public.compute_gym_review_verified_visit(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.set_gym_review_verified_visit() from public, anon, authenticated;

-- INSERT: always. UPDATE: whenever the flag, or the identity it's derived from, is being written.
-- (Users currently have no UPDATE policy on gym_reviews, so this is defence in depth - the column
-- grant is still wide open, so a future policy would otherwise expose the flag.)
create trigger trg_set_gym_review_verified_visit
  before insert or update of user_id, gym_id, is_verified_visit on public.gym_reviews
  for each row execute function public.set_gym_review_verified_visit();

-- ============ 3. Correct existing rows to match reality ============
-- Goes through the trigger above, so it uses exactly the same rule as new reviews.
update public.gym_reviews r
   set is_verified_visit = public.compute_gym_review_verified_visit(r.user_id, r.gym_id)
 where r.is_verified_visit is distinct from public.compute_gym_review_verified_visit(r.user_id, r.gym_id);
