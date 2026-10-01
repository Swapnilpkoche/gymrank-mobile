-- =====================================================================================
-- In-app membership renewal reminders. No push infrastructure: rows in `notifications` are
-- created by a daily job and read by the app. GymTrust takes no payment, so the copy only ever
-- says "renew at the gym".
-- =====================================================================================

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  gym_id     bigint not null references public.gyms(id) on delete cascade,
  term_id    bigint not null references public.gym_member_terms(id) on delete cascade,
  kind       text   not null,
  title      text   not null,
  body       text   not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  constraint notifications_kind_check check (kind in ('membership_expiring','membership_expiring_final','membership_expired')),
  -- dedupe: each reminder kind is sent at most once per person per term, however often the job runs
  constraint notifications_dedupe unique (user_id, kind, term_id)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Explicit grants (this project's recurring bug is a correct policy with a missing base grant).
-- Users can read their own rows and update ONLY read_at (column-level grant). No INSERT/DELETE for
-- clients at all - rows come only from send_membership_reminders() below.
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- =====================================================================================
-- The daily job. For each active member's CURRENT term (latest end_date), in IST calendar dates:
--   membership_expiring        : today >= end_date - reminder_window_days(plan)   (and not yet over)
--   membership_expiring_final  : today >= end_date - 3                             (and not yet over)
--   membership_expired         : the day after end_date onwards (7-day catch-up, so a missed run
--                                still notifies, but a first run can't spam long-lapsed members)
-- Legacy members (no term) get nothing. Idempotent: ON CONFLICT DO NOTHING on the dedupe key.
-- Internal only: no client role can call it; pg_cron runs it as the owner.
-- =====================================================================================
create or replace function public.send_membership_reminders()
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_today date := public.today_in_ist();
  v_count integer;
begin
  with cur as (
    select gm.user_id, gm.gym_id, g.name as gym_name, ct.id as term_id, ct.plan_type, ct.end_date
      from public.gym_members gm
      join public.gyms g on g.id = gm.gym_id
      join lateral (
        select t.id, t.plan_type, t.end_date
          from public.gym_member_terms t
         where t.member_id = gm.id
         order by t.end_date desc, t.id desc
         limit 1
      ) ct on true
     where gm.status = 'active'
  ), due as (
    select cur.*, k.kind
      from cur
      cross join lateral (values
        ('membership_expiring',       cur.end_date >= v_today and (cur.end_date - v_today) <= public.reminder_window_days(cur.plan_type)),
        ('membership_expiring_final', cur.end_date >= v_today and (cur.end_date - v_today) <= 3),
        ('membership_expired',        cur.end_date <  v_today and cur.end_date >= v_today - 7)
      ) k(kind, is_due)
     where k.is_due
  )
  insert into public.notifications (user_id, gym_id, term_id, kind, title, body)
  select d.user_id, d.gym_id, d.term_id, d.kind,
         case d.kind
           when 'membership_expiring'       then 'Membership ending soon'
           when 'membership_expiring_final' then 'Final reminder: membership ends soon'
           else 'Membership ended'
         end,
         case d.kind
           when 'membership_expired' then
             format('Your %s membership at %s ended on %s. Renew at the gym to get your member access back.',
                    replace(d.plan_type, '_', '-'), d.gym_name, to_char(d.end_date, 'FMDD FMMon YYYY'))
           else
             format('Your %s membership at %s ends on %s. Renew at the gym to keep your member access.',
                    replace(d.plan_type, '_', '-'), d.gym_name, to_char(d.end_date, 'FMDD FMMon YYYY'))
         end
    from due d
  on conflict (user_id, kind, term_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

revoke all on function public.send_membership_reminders() from public, anon, authenticated;

-- 09:00 IST = 03:30 UTC (pg_cron here runs in GMT; IST has no DST). Scheduling by name is an upsert.
select cron.schedule('membership-renewal-reminders', '30 3 * * *', $cron$select public.send_membership_reminders();$cron$);

-- =====================================================================================
-- Renewal clears stale reminders: when the owner records a new term, the member's older UNREAD
-- membership reminders for that gym are marked read. (Same function as before, plus that step.)
-- =====================================================================================
create or replace function public.renew_gym_member(p_member_id bigint, p_plan_type text, p_start_date date default null)
returns table (term_id bigint, term_plan_type text, term_start_date date, term_end_date date)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_caller  uuid := auth.uid();
  v_today   date := public.today_in_ist();
  v_member  public.gym_members%rowtype;
  v_cur_end date;
  v_start   date;
  v_end     date;
  v_term    bigint;
begin
  if v_caller is null then raise exception 'You need to be signed in.' using errcode = '42501'; end if;

  select * into v_member from public.gym_members where id = p_member_id for update;
  if not found then raise exception 'That member no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_gym_admin(v_member.gym_id) then
    raise exception 'Only a gym owner or admin can renew memberships.' using errcode = '42501';
  end if;
  if v_member.status <> 'active' then
    raise exception 'Only active members can be renewed.' using errcode = 'P0001';
  end if;
  if public.plan_term_months(p_plan_type) is null then
    raise exception 'Choose a plan: monthly, quarterly, half-yearly or annual.' using errcode = 'P0001';
  end if;

  select max(t.end_date) into v_cur_end from public.gym_member_terms t where t.member_id = p_member_id;

  if p_start_date is not null then
    v_start := p_start_date;
    if v_start < v_today - 366 or v_start > v_today + 366 then
      raise exception 'The start date must be within a year of today.' using errcode = 'P0001';
    end if;
  elsif v_cur_end is null then
    v_start := v_today;
  else
    v_start := greatest(v_today, v_cur_end + 1);
  end if;
  v_end := public.plan_term_end(v_start, p_plan_type);

  if v_end < v_today or (v_cur_end is not null and v_end <= v_cur_end) then
    raise exception 'This renewal wouldn''t extend the membership - check the start date.' using errcode = 'P0001';
  end if;

  insert into public.gym_member_terms (member_id, gym_id, user_id, plan_type, start_date, end_date, recorded_by)
  values (v_member.id, v_member.gym_id, v_member.user_id, p_plan_type, v_start, v_end, v_caller)
  returning id into v_term;

  update public.gym_members set updated_at = now() where id = p_member_id;

  update public.notifications n
     set read_at = now()
   where n.user_id = v_member.user_id
     and n.gym_id  = v_member.gym_id
     and n.read_at is null
     and n.kind in ('membership_expiring','membership_expiring_final','membership_expired');

  return query select v_term, p_plan_type, v_start, v_end;
end; $$;
