-- Removing an active team member, and leaving a gym on your own. Both are an UPDATE to
-- status = 'removed' (never a DELETE), so the row stays as the historical record and we know
-- who ended it and when. gym_staff is UNIQUE (gym_id, user_id): one row per person per gym.

alter table public.gym_staff
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null;
-- removed_by = user_id  -> the person left on their own
-- removed_by <> user_id -> an owner/admin removed them

-- Why RPCs and not plain UPDATE policies: the rules that matter here are cross-row and can't be
-- expressed in an RLS policy, and a policy would also leave role/user/gym editable in the same
-- statement. All access checks live in these functions; there is still NO direct UPDATE path on
-- active rows for clients (the only UPDATE policy remains the pending-request approval one).

-- ---------------------------------------------------------------------------
-- Owner/admin removes an active team member.
--   * only an active owner/admin OF THAT GYM can call it
--   * admins can remove manager/staff/trainer only. Owners and admins can be removed only by
--     an owner - otherwise any admin could seize a gym by removing its owner.
--   * you can't remove yourself here (use leave_gym, which has the last-owner protection)
-- ---------------------------------------------------------------------------
create or replace function public.remove_gym_staff_member(p_staff_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_caller      uuid := auth.uid();
  v_gym_id      bigint;
  v_target      public.gym_staff%rowtype;
  v_caller_role text;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select gym_id into v_gym_id from public.gym_staff where id = p_staff_id;
  if not found then
    raise exception 'That person is no longer an active member of this team.' using errcode = 'P0001';
  end if;

  -- Serialise against other owner changes at this gym (same lock order as leave_gym), so two
  -- owners removing each other at the same instant can't leave the gym with none.
  perform 1 from public.gym_staff
   where gym_id = v_gym_id and role = 'owner' and status = 'active'
   order by id for update;

  select * into v_target from public.gym_staff where id = p_staff_id for update;
  if not found or v_target.status <> 'active' then
    raise exception 'That person is no longer an active member of this team.' using errcode = 'P0001';
  end if;

  select role into v_caller_role
    from public.gym_staff
   where gym_id = v_target.gym_id and user_id = v_caller
     and status = 'active' and role in ('owner', 'admin');
  if v_caller_role is null then
    raise exception 'Only a gym owner or admin can remove team members.' using errcode = '42501';
  end if;

  if v_target.user_id = v_caller then
    raise exception 'To remove yourself, use "Leave this gym".' using errcode = 'P0001';
  end if;

  if v_target.role in ('owner', 'admin') and v_caller_role <> 'owner' then
    raise exception 'Only an owner can remove an owner or an admin.' using errcode = '42501';
  end if;

  update public.gym_staff
     set status = 'removed', removed_at = now(), removed_by = v_caller
   where id = p_staff_id;
end; $$;

-- ---------------------------------------------------------------------------
-- A team member (any role) leaves a gym themselves. Only ever touches the caller's OWN active
-- row at that gym. The last active owner can't leave - the gym would be left with nobody able
-- to approve requests or manage it (there is no ownership-transfer feature yet).
-- ---------------------------------------------------------------------------
create or replace function public.leave_gym(p_gym_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_caller       uuid := auth.uid();
  v_row          public.gym_staff%rowtype;
  v_other_owners integer;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  perform 1 from public.gym_staff
   where gym_id = p_gym_id and role = 'owner' and status = 'active'
   order by id for update;

  select * into v_row from public.gym_staff
   where gym_id = p_gym_id and user_id = v_caller and status = 'active'
   for update;
  if not found then
    raise exception 'You''re not an active member of this gym''s team.' using errcode = 'P0001';
  end if;

  if v_row.role = 'owner' then
    select count(*) into v_other_owners
      from public.gym_staff
     where gym_id = p_gym_id and role = 'owner' and status = 'active' and user_id <> v_caller;
    if v_other_owners = 0 then
      raise exception 'You''re the only owner of this gym, so you can''t leave it. Add another owner first.'
        using errcode = 'P0001';
    end if;
  end if;

  update public.gym_staff
     set status = 'removed', removed_at = now(), removed_by = v_caller
   where id = v_row.id;
end; $$;

revoke all on function public.remove_gym_staff_member(bigint) from public, anon;
revoke all on function public.leave_gym(bigint) from public, anon;
grant execute on function public.remove_gym_staff_member(bigint) to authenticated;
grant execute on function public.leave_gym(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Coming back. The row is kept on removal, and the unique (gym, user) constraint would block
-- any new request forever. Someone who LEFT on their own (removed_by = themselves) may clear
-- that row to start over - the same way an expired rejection can be cleared. Someone an admin
-- removed cannot: that was the gym's decision.
-- ---------------------------------------------------------------------------
drop policy "Users can cancel a pending request or clear an expired rejection" on public.gym_staff;

create policy "Users can cancel a request, clear an expired rejection, or clear a gym they left"
  on public.gym_staff for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (
      status = 'pending'
      or (status = 'rejected'
          and coalesce(responded_at, created_at) <= now() - public.trainer_request_cooldown())
      or (status = 'removed' and removed_by = user_id)
    )
  );
