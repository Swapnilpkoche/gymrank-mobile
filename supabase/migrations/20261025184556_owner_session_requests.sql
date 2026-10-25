-- ============================================================
-- Trainer session booking: tell the gym's owners/admins about new
-- requests (not only confirmations), let them see pending requests
-- in Upcoming sessions, and give them per-trainer request counts.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New notification kind
-- ------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'membership_expiring', 'membership_expiring_final', 'membership_expired',
    'session_requested', 'session_confirmed', 'session_declined', 'session_cancelled',
    'gym_session_confirmed', 'gym_session_requested'
  )
);

-- ------------------------------------------------------------
-- 2. request_trainer_session: owners/admins get their own copy
--    (unchanged apart from the final notification insert)
-- ------------------------------------------------------------

create or replace function public.request_trainer_session(
  p_trainer_id   uuid,
  p_gym_id       bigint,
  p_session_date date,
  p_start_time   time,
  p_note         text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller   uuid := auth.uid();
  v_today    date := public.today_in_ist();
  v_now_time time := (now() at time zone 'Asia/Kolkata')::time;
  v_note     text := nullif(btrim(p_note), '');
  v_id       bigint;
  v_gym_name text;
  v_label    text;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;
  if not public.is_adult(v_caller) then
    raise exception 'Booking a session is only available to adults (18+).' using errcode = '42501';
  end if;
  if p_trainer_id = v_caller then
    raise exception 'You can''t book a session with yourself.' using errcode = 'P0001';
  end if;
  if not public.is_active_trainer_at(p_trainer_id, p_gym_id) or not public.is_adult(p_trainer_id) then
    raise exception 'This trainer isn''t taking sessions at that gym.' using errcode = 'P0001';
  end if;
  if p_session_date is null or p_start_time is null then
    raise exception 'Pick a date and time.' using errcode = 'P0001';
  end if;
  if p_session_date < v_today or p_session_date > v_today + 28 then
    raise exception 'Pick a date within the next 4 weeks.' using errcode = 'P0001';
  end if;
  if p_session_date = v_today and p_start_time <= v_now_time then
    raise exception 'That time has already passed today.' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.trainer_availability_slots s
     where s.trainer_id = p_trainer_id
       and s.gym_id = p_gym_id
       and s.is_active
       and s.day_of_week = extract(dow from p_session_date)::smallint
       and s.start_time = p_start_time
  ) then
    raise exception 'That time isn''t one of this trainer''s available slots.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.trainer_session_bookings b
     where b.trainer_id = p_trainer_id
       and b.gym_id = p_gym_id
       and b.session_date = p_session_date
       and b.start_time = p_start_time
       and b.status = 'confirmed'
  ) then
    raise exception 'That slot is already booked. Pick another time.' using errcode = 'P0001';
  end if;

  -- Cap open requests per person per trainer so nobody can flood a trainer.
  if (
    select count(*) from public.trainer_session_bookings b
     where b.requested_by = v_caller
       and b.trainer_id = p_trainer_id
       and b.status = 'pending'
       and b.session_date >= v_today
  ) >= 5 then
    raise exception 'You already have 5 open requests with this trainer. Wait for a reply first.'
      using errcode = 'P0001';
  end if;

  begin
    insert into public.trainer_session_bookings
      (trainer_id, gym_id, requested_by, session_date, start_time, note)
    values
      (p_trainer_id, p_gym_id, v_caller, p_session_date, p_start_time, v_note)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You''ve already requested this slot.' using errcode = 'P0001';
  end;

  select g.name into v_gym_name from public.gyms g where g.id = p_gym_id;
  v_label := public.booking_slot_label(p_session_date, p_start_time);

  insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
  values (
    p_trainer_id, p_gym_id, v_id, 'session_requested', 'New session request',
    format('%s asked for a session at %s on %s.',
           public.booking_display_name(v_caller), v_gym_name, v_label)
  );

  -- The gym's owners/admins see incoming requests too, not just the
  -- confirmed ones. The trainer can't also be an owner/admin here
  -- (gym_staff is unique per gym and user); a requester who is one already
  -- knows.
  insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
  select gs.user_id, p_gym_id, v_id, 'gym_session_requested', 'Session requested at your gym',
         format('%s has a new session request from %s at %s on %s.',
                public.booking_display_name(p_trainer_id), public.booking_display_name(v_caller),
                v_gym_name, v_label)
    from public.gym_staff gs
   where gs.gym_id = p_gym_id
     and gs.status = 'active'
     and gs.role in ('owner', 'admin')
     and gs.user_id <> v_caller;

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- 3. get_gym_upcoming_sessions: pending requests too, with status
--    (return type changes, so drop + recreate)
-- ------------------------------------------------------------

drop function public.get_gym_upcoming_sessions(bigint);

-- Owner/admin view: upcoming sessions at their gym - confirmed ones and
-- requests still waiting on the trainer.
create function public.get_gym_upcoming_sessions(p_gym_id bigint)
returns table (
  booking_id     bigint,
  session_date   date,
  start_time     time,
  status         text,
  trainer_id     uuid,
  trainer_name   text,
  requester_id   uuid,
  requester_name text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_gym_admin(p_gym_id) then
    raise exception 'Only a gym owner or admin can see this gym''s sessions.' using errcode = '42501';
  end if;

  return query
    select b.id, b.session_date, b.start_time, b.status,
           b.trainer_id, public.booking_display_name(b.trainer_id),
           b.requested_by, public.booking_display_name(b.requested_by)
      from public.trainer_session_bookings b
     where b.gym_id = p_gym_id
       and b.status in ('confirmed', 'pending')
       and b.session_date >= public.today_in_ist()
     order by b.session_date, b.start_time, b.id;
end;
$$;

revoke all on function public.get_gym_upcoming_sessions(bigint) from public, anon;
grant execute on function public.get_gym_upcoming_sessions(bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. Per-trainer request / acceptance counts (all-time)
-- ------------------------------------------------------------

-- Owner/admin only. Trainers with no requests at this gym have no row;
-- the app shows them as 0. "Accepted" includes sessions the trainer
-- confirmed that were cancelled later: only a trainer's response sets
-- responded_at (cancelling never does), so a cancelled row with it set
-- was confirmed first - a declined one stays 'declined'.
create function public.get_gym_trainer_session_stats(p_gym_id bigint)
returns table (
  trainer_id         uuid,
  requests_received  bigint,
  requests_accepted  bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_gym_admin(p_gym_id) then
    raise exception 'Only a gym owner or admin can see this gym''s trainer stats.' using errcode = '42501';
  end if;

  return query
    select b.trainer_id,
           count(*),
           count(*) filter (
             where b.status = 'confirmed'
                or (b.status = 'cancelled' and b.responded_at is not null)
           )
      from public.trainer_session_bookings b
     where b.gym_id = p_gym_id
     group by b.trainer_id;
end;
$$;

revoke all on function public.get_gym_trainer_session_stats(bigint) from public, anon;
grant execute on function public.get_gym_trainer_session_stats(bigint) to authenticated;

-- The existing gym index is partial (confirmed only); this one covers the
-- all-status, per-trainer grouping above.
create index trainer_session_bookings_gym_trainer_idx
  on public.trainer_session_bookings (gym_id, trainer_id, status);
