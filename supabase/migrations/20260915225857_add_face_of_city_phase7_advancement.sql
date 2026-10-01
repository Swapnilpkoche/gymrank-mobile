-- Called whenever a matchup completes (by vote resolution or forfeit). If
-- every matchup in that round is now completed, closes the round and either
-- crowns the city winner (single remaining nominee) or creates the next
-- round pairing up this round's winners in matchup-id order. Round 2+ never
-- needs byes (halving a power-of-2 field always yields a power of 2), so
-- new rounds go straight to 'voting' with no 'pending' staging step.
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

  insert into public.bracket_rounds (contest_period_id, round_number, voting_start, voting_end, status)
  values (v_contest.id, v_round.round_number + 1, now(), now() + interval '3 days', 'voting')
  returning id into v_new_round_id;

  i := 1;
  while i < array_length(v_winner_ids, 1) loop
    insert into public.bracket_matchups (round_id, nominee_a_id, nominee_b_id, status)
    values (v_new_round_id, v_winner_ids[i], v_winner_ids[i + 1], 'voting');
    i := i + 2;
  end loop;
end;
$function$;

-- Runs periodically via pg_cron (same pattern as run_pending_gym_contest_resolutions):
-- resolves any 'voting' matchup whose round's voting window has closed, by
-- majority vote, then check-in count, then earliest entry_time.
create or replace function public.run_pending_bracket_matchup_resolutions()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchup record;
  v_a_votes bigint;
  v_b_votes bigint;
  v_winner_id bigint;
  v_a_checkins bigint;
  v_b_checkins bigint;
  v_a_entry timestamptz;
  v_b_entry timestamptz;
begin
  for v_matchup in
    select bm.id, bm.nominee_a_id, bm.nominee_b_id
    from public.bracket_matchups bm
    join public.bracket_rounds br on br.id = bm.round_id
    where bm.status = 'voting'
      and br.status = 'voting'
      and br.voting_end <= now()
  loop
    select
      count(*) filter (where nominee_id = v_matchup.nominee_a_id),
      count(*) filter (where nominee_id = v_matchup.nominee_b_id)
    into v_a_votes, v_b_votes
    from public.bracket_votes
    where matchup_id = v_matchup.id;

    if v_a_votes > v_b_votes then
      v_winner_id := v_matchup.nominee_a_id;
    elsif v_b_votes > v_a_votes then
      v_winner_id := v_matchup.nominee_b_id;
    else
      v_a_checkins := public.city_nomination_checkin_count(v_matchup.nominee_a_id);
      v_b_checkins := public.city_nomination_checkin_count(v_matchup.nominee_b_id);

      if v_a_checkins > v_b_checkins then
        v_winner_id := v_matchup.nominee_a_id;
      elsif v_b_checkins > v_a_checkins then
        v_winner_id := v_matchup.nominee_b_id;
      else
        select entry_time into v_a_entry from public.nominations where id = v_matchup.nominee_a_id;
        select entry_time into v_b_entry from public.nominations where id = v_matchup.nominee_b_id;
        v_winner_id := case when v_a_entry <= v_b_entry then v_matchup.nominee_a_id else v_matchup.nominee_b_id end;
      end if;
    end if;

    update public.bracket_matchups set status = 'completed', winner_id = v_winner_id where id = v_matchup.id;
    perform public.advance_bracket_round_if_complete(v_matchup.round_id);
  end loop;
end;
$function$;

select cron.schedule(
  'resolve-city-bracket-matchups',
  '*/10 * * * *',
  $$select public.run_pending_bracket_matchup_resolutions();$$
);
