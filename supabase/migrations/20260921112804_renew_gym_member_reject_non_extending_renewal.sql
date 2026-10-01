-- A renewal must actually extend the membership. Reject one whose resulting end_date would not be
-- later than the member's current end_date, or would already be in the past (before today, IST).
-- Only reachable with an explicit start_date: the default start (greatest(today, current end + 1))
-- always satisfies both conditions.
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
  return query select v_term, p_plan_type, v_start, v_end;
end; $$;
