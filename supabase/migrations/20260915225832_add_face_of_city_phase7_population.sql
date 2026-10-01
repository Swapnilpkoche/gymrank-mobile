-- Verified check-in count at a nomination's OWN originating gym - for a
-- city-level nomination this traces through source_nomination_id back to
-- the gym-level nomination (and its contest_period.gym_id); for a gym-level
-- nomination it resolves to itself. Used both for city-bracket seeding and
-- for the check-in tiebreak on a tied matchup.
create or replace function public.city_nomination_checkin_count(p_nomination_id bigint)
returns bigint
language sql
stable security definer
set search_path to 'public'
as $function$
  select count(*)
  from public.nominations n
  join public.nominations src on src.id = coalesce(n.source_nomination_id, n.id)
  join public.contest_periods gym_cp on gym_cp.id = src.contest_period_id
  join public.gym_checkins c on c.user_id = n.user_id and c.gym_id = gym_cp.gym_id and c.is_valid = true
  where n.id = p_nomination_id;
$function$;

-- Manual, admin-invoked (matching the manual contest-creation/resolution
-- pattern throughout this feature): gathers each qualifying gym's most
-- recently COMPLETED gym-level winner for this city+gender, copies each
-- into a new city-level nomination, seeds them by their own-gym check-in
-- count, and creates round 1 (status 'pending' - see start_bracket_round)
-- with byes assigned to the top seeds when the field isn't a power of 2.
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

  -- Seed 1 = highest check-in count. rank doubles as "seed number" here -
  -- gym-level uses the same column for post-vote ranking, but the two never
  -- share a contest_period so there's no collision in meaning.
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
    -- Sole qualifying nominee - outright city winner, no bracket needed.
    update public.contest_periods set status = 'completed', winner_id = v_seed_ids[1]
    where id = p_contest_period_id;
    return;
  end if;

  v_bracket_size := 1;
  while v_bracket_size < v_n loop
    v_bracket_size := v_bracket_size * 2;
  end loop;
  v_byes := v_bracket_size - v_n;

  insert into public.bracket_rounds (contest_period_id, round_number, voting_start, voting_end, status)
  values (p_contest_period_id, 1, now(), now() + interval '3 days', 'pending')
  returning id into v_round_id;

  -- Byes: top `v_byes` seeds each get their own auto-completed matchup with
  -- no opponent.
  for i in 1..v_byes loop
    insert into public.bracket_matchups (round_id, nominee_a_id, nominee_b_id, winner_id, status)
    values (v_round_id, v_seed_ids[i], null, v_seed_ids[i], 'completed');
  end loop;

  -- Remaining seeds pair high-vs-low: (byes+1) vs N, (byes+2) vs (N-1), ...
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

-- Manual, admin-invoked: activates a 'pending' round (and its non-bye
-- matchups) for voting. Kept as a separate step from populate_city_bracket
-- specifically so there's a real "before round 1 has entered voting" window
-- for the withdrawal cascading-promotion rule (item 7) to apply to.
create or replace function public.start_bracket_round(p_round_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.bracket_rounds set status = 'voting' where id = p_round_id and status = 'pending';
  update public.bracket_matchups
  set status = 'voting'
  where round_id = p_round_id and status = 'pending';
end;
$function$;
