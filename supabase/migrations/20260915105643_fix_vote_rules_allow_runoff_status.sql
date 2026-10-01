-- Bug fix: a runoff contest_period is created with status = 'runoff' (per
-- item 5b) and has its own voting_start/voting_end window - it needs to
-- accept votes during that window just like a normal 'voting' contest does.
-- Without this, votes could never actually be cast in a runoff round at all.
create or replace function public.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contest public.contest_periods%rowtype;
  v_nomination public.nominations%rowtype;
  v_has_valid_checkin boolean;
begin
  select * into v_contest from public.contest_periods where id = new.contest_period_id;
  if v_contest is null then
    raise exception 'Contest not found.';
  end if;

  if v_contest.status not in ('voting', 'runoff') then
    raise exception 'Voting is not currently open for this contest.';
  end if;

  select * into v_nomination from public.nominations where id = new.nominee_id;
  if v_nomination is null or v_nomination.contest_period_id <> new.contest_period_id then
    raise exception 'This nominee is not part of this contest.';
  end if;

  if v_nomination.status <> 'active' then
    raise exception 'This nominee has withdrawn and can no longer receive votes.';
  end if;

  select exists (
    select 1 from public.gym_checkins c
    where c.user_id = new.voter_id and c.gym_id = v_contest.gym_id and c.is_valid = true
  ) into v_has_valid_checkin;

  if not v_has_valid_checkin then
    raise exception 'You need a verified check-in at this gym to vote in its contest.';
  end if;

  return new;
end;
$function$;
