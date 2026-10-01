-- Cooldown after a REJECTED staff request: the user can't re-request the same gym for 48h.
--
-- How it's enforced: gym_staff is UNIQUE (gym_id, user_id), and a re-request has always been
-- "delete my rejected row, insert a new one". So the cooldown is simply: a user can't delete
-- their own rejected row until the cooldown has passed. Until then the insert hits the unique
-- constraint. No new table, and no client-side trust involved.

-- Single source of truth for the length (used by the policy and the remaining-time function).
create or replace function public.trainer_request_cooldown()
returns interval language sql immutable set search_path to 'public' as $$
  select interval '48 hours';
$$;

-- The cooldown clock must not be client-controlled. The approve/reject policy only requires
-- responded_at to be non-null, so an admin's client could send an old date and shorten it.
-- Stamp it server-side whenever a pending request is decided.
create or replace function public.stamp_staff_request_response()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if old.status = 'pending' and new.status in ('active', 'rejected') then
    new.responded_at := now();
  end if;
  return new;
end; $$;

create trigger trg_stamp_staff_request_response
  before update on public.gym_staff
  for each row execute function public.stamp_staff_request_response();

-- Trigger-only: nothing should be able to call it through /rest/v1/rpc.
revoke execute on function public.stamp_staff_request_response() from public, anon, authenticated;

-- Users can still cancel a pending request at any time; a rejected row can only be cleared
-- (which is what unlocks a re-request) once the cooldown has elapsed.
drop policy "Users can remove their own pending or rejected request" on public.gym_staff;

create policy "Users can cancel a pending request or clear an expired rejection"
  on public.gym_staff for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (
      status = 'pending'
      or (status = 'rejected'
          and coalesce(responded_at, created_at) <= now() - public.trainer_request_cooldown())
    )
  );

-- Seconds until the caller may re-request this gym: NULL if they have no rejected request
-- there, 0 once the cooldown has passed. Runs as the caller (reads only their own row), and
-- computed on the server clock so a wrong device clock can't skew the message.
create or replace function public.trainer_request_cooldown_remaining(p_gym_id bigint)
returns integer language sql stable set search_path to 'public' as $$
  select greatest(
    0,
    ceil(extract(epoch from (coalesce(gs.responded_at, gs.created_at) + public.trainer_request_cooldown() - now())))
  )::integer
  from public.gym_staff gs
  where gs.gym_id = p_gym_id
    and gs.user_id = (select auth.uid())
    and gs.status = 'rejected';
$$;

revoke all on function public.trainer_request_cooldown_remaining(bigint) from public, anon;
grant execute on function public.trainer_request_cooldown_remaining(bigint) to authenticated;
