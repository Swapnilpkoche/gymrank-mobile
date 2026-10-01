-- Only meaningful for city-level contests that have been populated - a
-- single duration computed once at population time and reused for every
-- round in that bracket (so rounds stay equal length instead of drifting
-- shorter as "time remaining" shrinks round over round).
alter table public.contest_periods add column round_duration interval;

create or replace function public.populate_city_bracket(p_contest_period_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contest public.contest_periods%rowtype;
  v_seed record;
  v_source public.nominations%rowtype;
  v_seed_list bigint[] := '{}';
  v_new_nomination_id bigint;
  v_n integer;
  v_bracket_size integer;
  v_total_rounds integer;
  v_round_duration interval;
  v_byes integer;
  v_round_id bigint;
  v_seed_ids bigint[];
  v_lo integer;
  v_hi integer;
  i integer;
begin
  select * into v_contest from public.contest_periods where id = p_contest_period_id;
  if v_contest is null or v_contest.level <> 'city' then
    raise exception 'Contest period must be a city-level contest.';
  end if;

  if exists (select 1 from public.bracket_rounds where contest_period_id = p_contest_period_id) then
    raise exception 'This city bracket has already been populated.';
  end if;

  perform set_config('app.internal_write', 'true', true);

  for v_seed in
    select distinct on (gym_cp.gym_id) gym_cp.winner_id
    from public.contest_periods gym_cp
    join public.gym_locations gl on gl.gym_id = gym_cp.gym_id and gl.is_primary = true
    join public.localities loc on loc.id = gl.locality_id
    join public.cities ci on ci.id = loc.city_id
    where gym_cp.level = 'gym'
      and gym_cp.status = 'completed'
      and gym_cp.gender = v_contest.gender
      and gym_cp.winner_id is not null
      and ci.id = v_contest.city_id
    order by gym_cp.gym_id, gym_cp.voting_end desc
  loop
    select * into v_source from public.nominations where id = v_seed.winner_id;
    if v_source is null then
      continue;
    end if;

    insert into public.nominations (
      contest_period_id, user_id, primary_photo_url, extra_photo_urls,
      status, consent_accepted_at, entry_time, source_nomination_id
    )
    values (
      p_contest_period_id, v_source.user_id, v_source.primary_photo_url, v_source.extra_photo_urls,
      'active', v_source.consent_accepted_at, v_source.entry_time, v_source.id
    )
    returning id into v_new_nomination_id;

    v_seed_list := array_append(v_seed_list, v_new_nomination_id);
  end loop;

  perform set_config('app.internal_write', 'false', true);

  v_n := coalesce(array_length(v_seed_list, 1), 0);
  if v_n = 0 then
    raise exception 'No completed gym-level winners found for this city and gender.';
  end if;

  with seeded as (
    select id, row_number() over (
      order by public.city_nomination_checkin_count(id) desc, entry_time asc
    ) as seed
    from public.nominations
    where id = any(v_seed_list)
  )
  update public.nominations n
  set rank = seeded.seed
  from seeded
  where n.id = seeded.id;

  select array_agg(id order by rank) into v_seed_ids
  from public.nominations
  where id = any(v_seed_list);

  if v_n = 1 then
    update public.contest_periods set status = 'completed', winner_id = v_seed_ids[1]
    where id = p_contest_period_id;
    return;
  end if;

  -- Bracket size (next power of 2 >= v_n) and how many rounds it takes to
  -- resolve to one champion, computed together via repeated doubling
  -- (integer-exact, avoids floating-point log() precision risk).
  v_bracket_size := 1;
  v_total_rounds := 0;
  while v_bracket_size < v_n loop
    v_bracket_size := v_bracket_size * 2;
    v_total_rounds := v_total_rounds + 1;
  end loop;
  v_byes := v_bracket_size - v_n;

  -- Dynamic per-round duration: split whatever time remains before the city
  -- contest's own voting_end evenly across every round this bracket will
  -- need, floored at 24 hours per round. Computed ONCE here, stored on the
  -- contest_period, and reused for every subsequent round by
  -- advance_bracket_round_if_complete - rounds stay equal length rather
  -- than drifting shorter as the bracket progresses.
  v_round_duration := greatest(interval '24 hours', (v_contest.voting_end - now()) / v_total_rounds);
  update public.contest_periods set round_duration = v_round_duration where id = p_contest_period_id;

  insert into public.bracket_rounds (contest_period_id, round_number, voting_start, voting_end, status)
  values (p_contest_period_id, 1, now(), now() + v_round_duration, 'pending')
  returning id into v_round_id;

  for i in 1..v_byes loop
    insert into public.bracket_matchups (round_id, nominee_a_id, nominee_b_id, winner_id, status)
    values (v_round_id, v_seed_ids[i], null, v_seed_ids[i], 'completed');
  end loop;

  v_lo := v_byes + 1;
  v_hi := v_n;
  while v_lo < v_hi loop
    insert into public.bracket_matchups (round_id, nominee_a_id, nominee_b_id, status)
    values (v_round_id, v_seed_ids[v_lo], v_seed_ids[v_hi], 'pending');
    v_lo := v_lo + 1;
    v_hi := v_hi - 1;
  end loop;
end;
$function$;

create or replace function public.advance_bracket_round_if_complete(p_round_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round public.bracket_rounds%rowtype;
  v_contest public.contest_periods%rowtype;
  v_incomplete_count integer;
  v_winner_ids bigint[];
  v_new_round_id bigint;
  i integer;
begin
  select * into v_round from public.bracket_rounds where id = p_round_id;
  if v_round is null or v_round.status = 'completed' then
    return;
  end if;

  select count(*) into v_incomplete_count
  from public.bracket_matchups
  where round_id = p_round_id and status <> 'completed';

  if v_incomplete_count > 0 then
    return;
  end if;

  update public.bracket_rounds set status = 'completed' where id = p_round_id;

  select array_agg(winner_id order by id) into v_winner_ids
  from public.bracket_matchups
  where round_id = p_round_id;

  select * into v_contest from public.contest_periods where id = v_round.contest_period_id;

  if array_length(v_winner_ids, 1) = 1 then
    update public.contest_periods
    set status = 'completed', winner_id = v_winner_ids[1]
    where id = v_contest.id;
    return;
  end if;

  -- Same round_duration computed once at population time, not recalculated
  -- from "time remaining" here.
  insert into public.bracket_rounds (contest_period_id, round_number, voting_start, voting_end, status)
  values (v_contest.id, v_round.round_number + 1, now(), now() + v_contest.round_duration, 'voting')
  returning id into v_new_round_id;

  i := 1;
  while i < array_length(v_winner_ids, 1) loop
    insert into public.bracket_matchups (round_id, nominee_a_id, nominee_b_id, status)
    values (v_new_round_id, v_winner_ids[i], v_winner_ids[i + 1], 'voting');
    i := i + 2;
  end loop;
end;
$function$;
