-- Trainer session booking.
--   * trainer_availability_slots: a trainer's weekly slots, per gym they're an
--     active trainer at. Written by the trainer directly (RLS); read with the
--     same visibility as get_public_profile (signed in, or an adult trainer).
--   * trainer_session_bookings: requests/bookings. No client writes at all -
--     every change goes through the SECURITY DEFINER RPCs below.
--   * notifications: reused for booking events. term_id becomes nullable and a
--     booking_id is added; a check ties membership kinds to term_id and
--     session kinds to booking_id. The table has no rows yet, and the
--     membership dedupe (user_id, kind, term_id) is unchanged.
-- All "today"/"now" logic is Asia/Kolkata, like the rest of the app.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Same visibility as the "Anyone can view active gym staff" policy, so this
-- reveals nothing new. Used by RLS, hence executable by anon too.
create or replace function public.is_active_trainer_at(p_user_id uuid, p_gym_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.gym_staff
     where user_id = p_user_id
       and gym_id = p_gym_id
       and role = 'trainer'
       and status = 'active'
  );
$$;

revoke all on function public.is_active_trainer_at(uuid, bigint) from public;
grant execute on function public.is_active_trainer_at(uuid, bigint) to anon, authenticated;

-- Name used inside notification text. Internal only (called from the
-- SECURITY DEFINER RPCs, which run as the owner).
create or replace function public.booking_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), ''))
       from public.profiles p where p.id = p_user_id),
    'A GymTrust member'
  );
$$;

revoke all on function public.booking_display_name(uuid) from public, anon, authenticated;

-- "Sat 24 Oct at 7:00 AM"
create or replace function public.booking_slot_label(p_date date, p_time time)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select to_char(p_date, 'FMDy FMDD FMMon') || ' at ' || to_char(p_time, 'FMHH12:MI AM');
$$;

revoke all on function public.booking_slot_label(date, time) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. trainer_availability_slots
-- ---------------------------------------------------------------------------

create table public.trainer_availability_slots (
  id          bigint generated always as identity primary key,
  trainer_id  uuid not null references public.profiles(id) on delete cascade,
  gym_id      bigint not null references public.gyms(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time  time not null check (extract(second from start_time) = 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (trainer_id, gym_id, day_of_week, start_time)
);

create index trainer_availability_slots_gym_idx on public.trainer_availability_slots (gym_id);

alter table public.trainer_availability_slots enable row level security;

-- Others only see slots while the trainer is still active at that gym, and
-- guests only see adults' - the same rule get_public_profile uses.
create policy "View trainer availability"
  on public.trainer_availability_slots
  for select
  to anon, authenticated
  using (
    trainer_id = (select auth.uid())
    or (
      is_active
      and public.is_active_trainer_at(trainer_id, gym_id)
      and ((select auth.uid()) is not null or public.is_adult(trainer_id))
    )
  );

create policy "Active trainers add their own slots"
  on public.trainer_availability_slots
  for insert
  to authenticated
  with check (
    trainer_id = (select auth.uid())
    and public.is_active_trainer_at((select auth.uid()), gym_id)
  );

create policy "Active trainers update their own slots"
  on public.trainer_availability_slots
  for update
  to authenticated
  using (
    trainer_id = (select auth.uid())
    and public.is_active_trainer_at((select auth.uid()), gym_id)
  )
  with check (
    trainer_id = (select auth.uid())
    and public.is_active_trainer_at((select auth.uid()), gym_id)
  );

create policy "Active trainers delete their own slots"
  on public.trainer_availability_slots
  for delete
  to authenticated
  using (
    trainer_id = (select auth.uid())
    and public.is_active_trainer_at((select auth.uid()), gym_id)
  );

revoke all on table public.trainer_availability_slots from anon, authenticated;
grant select on table public.trainer_availability_slots to anon, authenticated;
grant insert (trainer_id, gym_id, day_of_week, start_time, is_active)
  on table public.trainer_availability_slots to authenticated;
grant update (is_active) on table public.trainer_availability_slots to authenticated;
grant delete on table public.trainer_availability_slots to authenticated;

-- ---------------------------------------------------------------------------
-- 2. trainer_session_bookings
-- ---------------------------------------------------------------------------

create table public.trainer_session_bookings (
  id           bigint generated always as identity primary key,
  trainer_id   uuid not null references public.profiles(id) on delete cascade,
  gym_id       bigint not null references public.gyms(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  start_time   time not null,
  status       text not null default 'pending'
               check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requested_by <> trainer_id)
);

-- No double-booking: one confirmed session per trainer+gym+date+time.
create unique index trainer_session_bookings_one_confirmed
  on public.trainer_session_bookings (trainer_id, gym_id, session_date, start_time)
  where status = 'confirmed';

-- One open request per person per slot (stops repeat-tap spam).
create unique index trainer_session_bookings_one_pending_per_requester
  on public.trainer_session_bookings (requested_by, trainer_id, gym_id, session_date, start_time)
  where status = 'pending';

create index trainer_session_bookings_trainer_idx
  on public.trainer_session_bookings (trainer_id, session_date);
create index trainer_session_bookings_requester_idx
  on public.trainer_session_bookings (requested_by, session_date);
create index trainer_session_bookings_gym_confirmed_idx
  on public.trainer_session_bookings (gym_id, session_date)
  where status = 'confirmed';

alter table public.trainer_session_bookings enable row level security;

create policy "Participants view their own bookings"
  on public.trainer_session_bookings
  for select
  to authenticated
  using (requested_by = (select auth.uid()) or trainer_id = (select auth.uid()));

-- Read-only to clients; the RPCs are the only writers.
revoke all on table public.trainer_session_bookings from anon, authenticated;
grant select on table public.trainer_session_bookings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. notifications: allow booking events
-- ---------------------------------------------------------------------------

alter table public.notifications alter column term_id drop not null;

alter table public.notifications
  add column booking_id bigint references public.trainer_session_bookings(id) on delete cascade;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'membership_expiring', 'membership_expiring_final', 'membership_expired',
    'session_requested', 'session_confirmed', 'session_declined', 'session_cancelled',
    'gym_session_confirmed'
  )
);

alter table public.notifications add constraint notifications_subject_check check (
  (kind like 'membership\_%' and term_id is not null and booking_id is null)
  or (kind not like 'membership\_%' and booking_id is not null and term_id is null)
);

create index notifications_booking_idx on public.notifications (booking_id)
  where booking_id is not null;

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------

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

  insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
  values (
    p_trainer_id, p_gym_id, v_id, 'session_requested', 'New session request',
    format('%s asked for a session at %s on %s.',
           public.booking_display_name(v_caller), v_gym_name,
           public.booking_slot_label(p_session_date, p_start_time))
  );

  return v_id;
end;
$$;

create or replace function public.respond_trainer_session(p_booking_id bigint, p_decision text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller       uuid := auth.uid();
  v_today        date := public.today_in_ist();
  v_now_time     time := (now() at time zone 'Asia/Kolkata')::time;
  v_b            public.trainer_session_bookings%rowtype;
  v_gym_name     text;
  v_label        text;
  v_trainer_name text;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('confirmed', 'declined') then
    raise exception 'Choose confirm or decline.' using errcode = 'P0001';
  end if;

  select * into v_b from public.trainer_session_bookings where id = p_booking_id for update;
  if not found or v_b.trainer_id <> v_caller then
    raise exception 'That session request isn''t yours to answer.' using errcode = '42501';
  end if;
  if v_b.status <> 'pending' then
    raise exception 'This request has already been answered or cancelled.' using errcode = 'P0001';
  end if;

  select g.name into v_gym_name from public.gyms g where g.id = v_b.gym_id;
  v_label := public.booking_slot_label(v_b.session_date, v_b.start_time);
  v_trainer_name := public.booking_display_name(v_caller);

  if p_decision = 'confirmed' then
    if v_b.session_date < v_today or (v_b.session_date = v_today and v_b.start_time <= v_now_time) then
      raise exception 'This session time has already passed - decline it instead.' using errcode = 'P0001';
    end if;
    if not public.is_active_trainer_at(v_caller, v_b.gym_id) then
      raise exception 'You''re no longer an active trainer at this gym.' using errcode = 'P0001';
    end if;

    begin
      update public.trainer_session_bookings
         set status = 'confirmed', responded_at = now()
       where id = v_b.id;
    exception when unique_violation then
      raise exception 'You already have a confirmed session at this time.' using errcode = 'P0001';
    end;

    -- Everyone else waiting on the same slot is declined, and told so.
    with declined as (
      update public.trainer_session_bookings
         set status = 'declined', responded_at = now()
       where trainer_id = v_b.trainer_id
         and gym_id = v_b.gym_id
         and session_date = v_b.session_date
         and start_time = v_b.start_time
         and status = 'pending'
         and id <> v_b.id
      returning id, requested_by
    )
    insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
    select d.requested_by, v_b.gym_id, d.id, 'session_declined', 'Session request declined',
           format('%s couldn''t take your session at %s on %s - that slot was booked.',
                  v_trainer_name, v_gym_name, v_label)
      from declined d;

    insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
    values (
      v_b.requested_by, v_b.gym_id, v_b.id, 'session_confirmed', 'Session confirmed',
      format('%s confirmed your session at %s on %s.', v_trainer_name, v_gym_name, v_label)
    );

    -- The gym's owners/admins are always told what's booked at their gym.
    insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
    select gs.user_id, v_b.gym_id, v_b.id, 'gym_session_confirmed', 'Session booked at your gym',
           format('%s has a confirmed session with %s at %s on %s.',
                  v_trainer_name, public.booking_display_name(v_b.requested_by), v_gym_name, v_label)
      from public.gym_staff gs
     where gs.gym_id = v_b.gym_id
       and gs.status = 'active'
       and gs.role in ('owner', 'admin')
       and gs.user_id <> v_caller;
  else
    update public.trainer_session_bookings
       set status = 'declined', responded_at = now()
     where id = v_b.id;

    insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
    values (
      v_b.requested_by, v_b.gym_id, v_b.id, 'session_declined', 'Session request declined',
      format('%s declined your session request at %s on %s.', v_trainer_name, v_gym_name, v_label)
    );
  end if;
end;
$$;

create or replace function public.cancel_trainer_session(p_booking_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_b      public.trainer_session_bookings%rowtype;
  v_other  uuid;
  v_gym_name text;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into v_b from public.trainer_session_bookings where id = p_booking_id for update;
  if not found or v_caller not in (v_b.requested_by, v_b.trainer_id) then
    raise exception 'That session isn''t yours to cancel.' using errcode = '42501';
  end if;
  if v_b.status not in ('pending', 'confirmed') then
    raise exception 'This session is already closed.' using errcode = 'P0001';
  end if;

  update public.trainer_session_bookings set status = 'cancelled' where id = v_b.id;

  v_other := case when v_caller = v_b.requested_by then v_b.trainer_id else v_b.requested_by end;
  select g.name into v_gym_name from public.gyms g where g.id = v_b.gym_id;

  insert into public.notifications (user_id, gym_id, booking_id, kind, title, body)
  values (
    v_other, v_b.gym_id, v_b.id, 'session_cancelled',
    case when v_b.status = 'pending' then 'Session request cancelled' else 'Session cancelled' end,
    format(
      case when v_b.status = 'pending'
           then '%s cancelled the session request at %s on %s.'
           else '%s cancelled the session at %s on %s.' end,
      public.booking_display_name(v_caller), v_gym_name,
      public.booking_slot_label(v_b.session_date, v_b.start_time)
    )
  );
end;
$$;

-- The caller's bookings from both sides (as trainer and as requester), from a
-- week ago onward, with the other person's name and the gym's.
create or replace function public.get_my_trainer_sessions()
returns table (
  booking_id     bigint,
  is_trainer     boolean,
  other_user_id  uuid,
  other_name     text,
  gym_id         bigint,
  gym_name       text,
  session_date   date,
  start_time     time,
  status         text,
  note           text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id,
         b.trainer_id = auth.uid(),
         case when b.trainer_id = auth.uid() then b.requested_by else b.trainer_id end,
         public.booking_display_name(
           case when b.trainer_id = auth.uid() then b.requested_by else b.trainer_id end),
         b.gym_id,
         g.name,
         b.session_date,
         b.start_time,
         b.status,
         b.note,
         b.created_at
    from public.trainer_session_bookings b
    join public.gyms g on g.id = b.gym_id
   where auth.uid() is not null
     and (b.trainer_id = auth.uid() or b.requested_by = auth.uid())
     and b.session_date >= public.today_in_ist() - 7
   order by b.session_date, b.start_time, b.id;
$$;

-- Owner/admin view: confirmed upcoming sessions at their gym.
create or replace function public.get_gym_upcoming_sessions(p_gym_id bigint)
returns table (
  booking_id     bigint,
  session_date   date,
  start_time     time,
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
    select b.id, b.session_date, b.start_time,
           b.trainer_id, public.booking_display_name(b.trainer_id),
           b.requested_by, public.booking_display_name(b.requested_by)
      from public.trainer_session_bookings b
     where b.gym_id = p_gym_id
       and b.status = 'confirmed'
       and b.session_date >= public.today_in_ist()
     order by b.session_date, b.start_time, b.id;
end;
$$;

-- Which upcoming slots are already taken, so the booking screen can hide
-- them. Dates and times only - never who booked.
create or replace function public.get_trainer_booked_slots(p_trainer_id uuid, p_gym_id bigint)
returns table (session_date date, start_time time)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.session_date, b.start_time
    from public.trainer_session_bookings b
   where auth.uid() is not null
     and b.trainer_id = p_trainer_id
     and b.gym_id = p_gym_id
     and b.status = 'confirmed'
     and b.session_date between public.today_in_ist() and public.today_in_ist() + 28;
$$;

revoke all on function public.request_trainer_session(uuid, bigint, date, time, text) from public, anon;
revoke all on function public.respond_trainer_session(bigint, text) from public, anon;
revoke all on function public.cancel_trainer_session(bigint) from public, anon;
revoke all on function public.get_my_trainer_sessions() from public, anon;
revoke all on function public.get_gym_upcoming_sessions(bigint) from public, anon;
revoke all on function public.get_trainer_booked_slots(uuid, bigint) from public, anon;

grant execute on function public.request_trainer_session(uuid, bigint, date, time, text) to authenticated;
grant execute on function public.respond_trainer_session(bigint, text) to authenticated;
grant execute on function public.cancel_trainer_session(bigint) to authenticated;
grant execute on function public.get_my_trainer_sessions() to authenticated;
grant execute on function public.get_gym_upcoming_sessions(bigint) to authenticated;
grant execute on function public.get_trainer_booked_slots(uuid, bigint) to authenticated;
