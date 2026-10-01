-- =====================================================================================
-- Membership terms. GymTrust records what a member is paid up to; it processes no payments.
-- All date logic is server-side, in Asia/Kolkata calendar dates. A term's end_date is the LAST
-- day of the term, inclusive: end_date = start_date + N calendar months - 1 day.
-- =====================================================================================

-- ---------- pure helpers (internal only: no client role can call them) ----------
create or replace function public.today_in_ist()
returns date language sql stable set search_path to 'public' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

create or replace function public.plan_term_months(p_plan_type text)
returns integer language sql immutable set search_path to 'public' as $$
  select case p_plan_type when 'monthly' then 1 when 'quarterly' then 3 when 'half_yearly' then 6 when 'annual' then 12 end;
$$;

-- calendar-month arithmetic (Postgres clamps to month end, e.g. 31 Jan + 1 month = 28 Feb)
create or replace function public.plan_term_end(p_start date, p_plan_type text)
returns date language sql immutable set search_path to 'public' as $$
  select (p_start + make_interval(months => public.plan_term_months(p_plan_type)))::date - 1;
$$;

-- A2: ONE source of truth for how early a renewal reminder starts (owner list + Part B job)
create or replace function public.reminder_window_days(p_plan_type text)
returns integer language sql immutable set search_path to 'public' as $$
  select case p_plan_type when 'monthly' then 7 when 'quarterly' then 15 when 'half_yearly' then 21 when 'annual' then 30 end;
$$;

-- one place that turns (row status, current term) into a display state
create or replace function public.membership_state(p_status text, p_plan_type text, p_end_date date)
returns text language sql stable set search_path to 'public' as $$
  select case
    when p_status <> 'active' then p_status                                   -- pending / rejected / removed
    when p_end_date is null then 'no_plan'                                    -- legacy member, no term yet
    when p_end_date < public.today_in_ist() then 'expired'
    when (p_end_date - public.today_in_ist()) <= public.reminder_window_days(p_plan_type) then 'expiring_soon'
    else 'active'
  end;
$$;

-- ---------- A1: the terms table ----------
-- composite FK target so a term can never point at a member row with a different gym/user
alter table public.gym_members add constraint gym_members_id_gym_user_key unique (id, gym_id, user_id);

create table public.gym_member_terms (
  id          bigint generated always as identity primary key,
  member_id   bigint not null,
  gym_id      bigint not null,
  user_id     uuid   not null,
  plan_type   text   not null,
  start_date  date   not null,
  end_date    date   not null,                         -- LAST day of the term, inclusive
  recorded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint gym_member_terms_member_fk
    foreign key (member_id, gym_id, user_id) references public.gym_members (id, gym_id, user_id) on delete cascade,
  constraint gym_member_terms_plan_check check (plan_type in ('monthly','quarterly','half_yearly','annual')),
  constraint gym_member_terms_dates_check check (end_date >= start_date),
  -- the stored end date can only ever be the one the plan implies
  constraint gym_member_terms_end_matches_plan check (end_date = public.plan_term_end(start_date, plan_type))
);
create index gym_member_terms_member_end_idx on public.gym_member_terms (member_id, end_date desc);
create index gym_member_terms_gym_end_idx    on public.gym_member_terms (gym_id, end_date);

alter table public.gym_member_terms enable row level security;
-- Private: a member sees their own terms; a gym's owners/admins see that gym's. Nobody else.
-- No INSERT/UPDATE/DELETE policy and no such grants: every write goes through the RPCs below.
revoke all on table public.gym_member_terms from anon, authenticated;
grant select on table public.gym_member_terms to authenticated;

create policy "Members see their own terms and gym admins see their gym's terms"
  on public.gym_member_terms for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gym_admin(gym_id));

-- ---------- A3: is_active_member ----------
-- status = 'active' AND (no term at all -> legacy member, treated as active
--                        OR current term (latest end_date) has not ended, in IST). No grace period.
create or replace function public.is_active_member(p_gym_id bigint, p_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
      from public.gym_members gm
      left join lateral (
        select max(t.end_date) as end_date from public.gym_member_terms t where t.member_id = gm.id
      ) ct on true
     where gm.gym_id = p_gym_id
       and gm.user_id = p_user_id
       and gm.status = 'active'
       and (ct.end_date is null or ct.end_date >= public.today_in_ist())
  );
$$;

-- member counts now exclude expired members
create or replace function public.get_gym_member_counts()
returns table (gym_id bigint, active_member_count bigint)
language sql stable security definer set search_path to 'public' as $$
  select gm.gym_id, count(*)
    from public.gym_members gm
   where public.is_active_member(gm.gym_id, gm.user_id)
   group by gm.gym_id;
$$;

-- ---------- A4: RPCs ----------
-- Owner picks a plan (and start date, default today) when approving; the first term is inserted.
create or replace function public.approve_gym_member_request(p_member_id bigint, p_plan_type text, p_start_date date default null)
returns table (term_id bigint, term_plan_type text, term_start_date date, term_end_date date)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_caller uuid := auth.uid();
  v_today  date := public.today_in_ist();
  v_member public.gym_members%rowtype;
  v_start  date;
  v_end    date;
  v_term   bigint;
begin
  if v_caller is null then raise exception 'You need to be signed in.' using errcode = '42501'; end if;

  select * into v_member from public.gym_members where id = p_member_id for update;
  if not found then raise exception 'That member request no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_gym_admin(v_member.gym_id) then
    raise exception 'Only a gym owner or admin can approve member requests.' using errcode = '42501';
  end if;
  if v_member.status <> 'pending' then
    raise exception 'This request has already been handled.' using errcode = 'P0001';
  end if;
  if public.plan_term_months(p_plan_type) is null then
    raise exception 'Choose a plan: monthly, quarterly, half-yearly or annual.' using errcode = 'P0001';
  end if;

  v_start := coalesce(p_start_date, v_today);
  if v_start < v_today - 366 or v_start > v_today + 366 then
    raise exception 'The start date must be within a year of today.' using errcode = 'P0001';
  end if;
  v_end := public.plan_term_end(v_start, p_plan_type);

  update public.gym_members
     set status = 'active', responded_by = v_caller, responded_at = now(), updated_at = now()
   where id = p_member_id;

  insert into public.gym_member_terms (member_id, gym_id, user_id, plan_type, start_date, end_date, recorded_by)
  values (v_member.id, v_member.gym_id, v_member.user_id, p_plan_type, v_start, v_end, v_caller)
  returning id into v_term;

  return query select v_term, p_plan_type, v_start, v_end;
end; $$;

-- Rejecting also goes through an RPC now: the old direct-UPDATE approval policy is dropped below
-- (it let an admin activate a member with NO term, i.e. a permanent "legacy" member).
create or replace function public.reject_gym_member_request(p_member_id bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_caller uuid := auth.uid();
  v_member public.gym_members%rowtype;
begin
  if v_caller is null then raise exception 'You need to be signed in.' using errcode = '42501'; end if;
  select * into v_member from public.gym_members where id = p_member_id for update;
  if not found then raise exception 'That member request no longer exists.' using errcode = 'P0001'; end if;
  if not public.is_gym_admin(v_member.gym_id) then
    raise exception 'Only a gym owner or admin can decline member requests.' using errcode = '42501';
  end if;
  if v_member.status <> 'pending' then
    raise exception 'This request has already been handled.' using errcode = 'P0001';
  end if;
  update public.gym_members
     set status = 'rejected', responded_by = v_caller, responded_at = now(), updated_at = now()
   where id = p_member_id;
end; $$;

-- Renew / set a plan. start = greatest(today, current end + 1) unless given, so an early renewal
-- loses no days. Also how a legacy member (no term) gets their first plan.
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

  insert into public.gym_member_terms (member_id, gym_id, user_id, plan_type, start_date, end_date, recorded_by)
  values (v_member.id, v_member.gym_id, v_member.user_id, p_plan_type, v_start, v_end, v_caller)
  returning id into v_term;

  update public.gym_members set updated_at = now() where id = p_member_id;
  return query select v_term, p_plan_type, v_start, v_end;
end; $$;

-- What the sheet shows before confirming, computed HERE so the app does no date math.
-- With p_member_id (renewal) the default start honours the current term; without it (approval) it is today.
create or replace function public.preview_member_term(p_plan_type text, p_start_date date default null, p_member_id bigint default null)
returns table (term_start_date date, term_end_date date, today date)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_today   date := public.today_in_ist();
  v_start   date;
  v_cur_end date;
  v_gym     bigint;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.' using errcode = '42501'; end if;
  if public.plan_term_months(p_plan_type) is null then
    raise exception 'Choose a plan: monthly, quarterly, half-yearly or annual.' using errcode = 'P0001';
  end if;

  if p_member_id is not null then
    select gm.gym_id into v_gym from public.gym_members gm where gm.id = p_member_id;
    if v_gym is null or not public.is_gym_admin(v_gym) then
      raise exception 'Only a gym owner or admin can do this.' using errcode = '42501';
    end if;
    select max(t.end_date) into v_cur_end from public.gym_member_terms t where t.member_id = p_member_id;
  end if;

  v_start := coalesce(p_start_date, case when v_cur_end is null then v_today else greatest(v_today, v_cur_end + 1) end);
  return query select v_start, public.plan_term_end(v_start, p_plan_type), v_today;
end; $$;

-- Owner's Members screen: one call returns everything (summary, members with state, pending requests).
create or replace function public.get_gym_members_for_owner(p_gym_id bigint)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_today    date := public.today_in_ist();
  v_members  jsonb;
  v_summary  jsonb;
  v_requests jsonb;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.' using errcode = '42501'; end if;
  if not public.is_gym_admin(p_gym_id) then
    raise exception 'Only a gym owner or admin can view the member list.' using errcode = '42501';
  end if;

  with m as (
    select gm.id as member_id, gm.user_id, pr.full_name, pr.username, pr.avatar_url,
           ct.plan_type, ct.start_date, ct.end_date,
           (ct.end_date - v_today) as days_left,
           public.membership_state('active', ct.plan_type, ct.end_date) as state
      from public.gym_members gm
      left join public.profiles pr on pr.id = gm.user_id
      left join lateral (
        select t.plan_type, t.start_date, t.end_date
          from public.gym_member_terms t
         where t.member_id = gm.id
         order by t.end_date desc, t.id desc limit 1
      ) ct on true
     where gm.gym_id = p_gym_id and gm.status = 'active'
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.end_date asc nulls last, lower(coalesce(m.full_name, m.username, ''))), '[]'::jsonb),
         jsonb_build_object(
           'active',                 count(*) filter (where m.state <> 'expired'),
           'expiring_soon',          count(*) filter (where m.state = 'expiring_soon'),
           'expiring_within_7_days', count(*) filter (where m.state in ('active','expiring_soon') and m.days_left between 0 and 7),
           'expired',                count(*) filter (where m.state = 'expired'),
           'no_plan',                count(*) filter (where m.state = 'no_plan'),
           'by_plan', jsonb_build_object(
             'monthly',     count(*) filter (where m.plan_type = 'monthly'     and m.state <> 'expired'),
             'quarterly',   count(*) filter (where m.plan_type = 'quarterly'   and m.state <> 'expired'),
             'half_yearly', count(*) filter (where m.plan_type = 'half_yearly' and m.state <> 'expired'),
             'annual',      count(*) filter (where m.plan_type = 'annual'      and m.state <> 'expired'))
         )
    into v_members, v_summary
    from m;

  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', gm.id, 'user_id', gm.user_id, 'full_name', pr.full_name, 'username', pr.username,
           'avatar_url', pr.avatar_url, 'requested_at', gm.created_at) order by gm.created_at), '[]'::jsonb)
    into v_requests
    from public.gym_members gm
    left join public.profiles pr on pr.id = gm.user_id
   where gm.gym_id = p_gym_id and gm.status = 'pending';

  return jsonb_build_object('today', v_today, 'summary', v_summary, 'members', v_members, 'requests', v_requests);
end; $$;

-- The caller's OWN memberships (any status), with state. This is how the app decides "am I a member",
-- without ever needing to read term dates it isn't allowed to see for anyone else.
create or replace function public.get_my_memberships(p_gym_id bigint default null)
returns table (gym_id bigint, gym_name text, member_id bigint, member_status text, state text,
               plan_type text, start_date date, end_date date, days_left integer, reminder_window_days integer)
language sql stable security definer set search_path to 'public' as $$
  select gm.gym_id, g.name, gm.id, gm.status,
         public.membership_state(gm.status, ct.plan_type, ct.end_date),
         ct.plan_type, ct.start_date, ct.end_date,
         (ct.end_date - public.today_in_ist())::integer,
         public.reminder_window_days(ct.plan_type)
    from public.gym_members gm
    join public.gyms g on g.id = gm.gym_id
    left join lateral (
      select t.plan_type, t.start_date, t.end_date
        from public.gym_member_terms t
       where t.member_id = gm.id
       order by t.end_date desc, t.id desc limit 1
    ) ct on true
   where gm.user_id = auth.uid()
     and (p_gym_id is null or gm.gym_id = p_gym_id);
$$;

-- ---------- grants: RPCs authenticated-only; helpers internal-only ----------
revoke all on function public.approve_gym_member_request(bigint, text, date) from public, anon;
revoke all on function public.reject_gym_member_request(bigint)              from public, anon;
revoke all on function public.renew_gym_member(bigint, text, date)           from public, anon;
revoke all on function public.preview_member_term(text, date, bigint)        from public, anon;
revoke all on function public.get_gym_members_for_owner(bigint)              from public, anon;
revoke all on function public.get_my_memberships(bigint)                     from public, anon;
grant execute on function public.approve_gym_member_request(bigint, text, date) to authenticated;
grant execute on function public.reject_gym_member_request(bigint)              to authenticated;
grant execute on function public.renew_gym_member(bigint, text, date)           to authenticated;
grant execute on function public.preview_member_term(text, date, bigint)        to authenticated;
grant execute on function public.get_gym_members_for_owner(bigint)              to authenticated;
grant execute on function public.get_my_memberships(bigint)                     to authenticated;

revoke all on function public.today_in_ist()                          from public, anon, authenticated;
revoke all on function public.plan_term_months(text)                  from public, anon, authenticated;
revoke all on function public.plan_term_end(date, text)               from public, anon, authenticated;
revoke all on function public.reminder_window_days(text)              from public, anon, authenticated;
revoke all on function public.membership_state(text, text, date)      from public, anon, authenticated;
revoke all on function public.is_active_member(bigint, uuid)          from public, anon, authenticated;

-- ---------- close the term-less approval path ----------
-- Approval/rejection now happen only through the RPCs above. Clients keep INSERT (request to join)
-- and DELETE (cancel own pending/rejected request) on gym_members, but no UPDATE at all.
drop policy "Gym admins can approve or reject member requests" on public.gym_members;
revoke update on public.gym_members from anon, authenticated;
