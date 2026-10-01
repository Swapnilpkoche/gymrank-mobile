-- Withdrawal handling for a city-level nomination. Finds the withdrawing
-- nominee's most advanced (highest round_number) matchup:
--   - If it's specifically ROUND 1 and round 1 is still 'pending' (voting
--     hasn't started for the whole bracket yet): cascading promotion -
--     bring in the next-highest-seeded gym-level winner for this city+
--     gender not already a city nominee here, and swap them into that slot.
--   - Otherwise (round 1 already voting/completed, or any later round):
--     forfeit - their opponent in that matchup automatically advances, no
--     replacement is brought in. If the matchup was already 'completed'
--     before this withdrawal, there's nothing to do - they're already
--     either eliminated or already advanced past this point.
create or replace function public.resolve_city_withdrawal(p_nomination_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nomination public.nominations%rowtype;
  v_contest public.contest_periods%rowtype;
  v_matchup public.bracket_matchups%rowtype;
  v_round public.bracket_rounds%rowtype;
  v_opponent_id bigint;
  v_replacement_id bigint;
  v_source public.nominations%rowtype;
  v_new_id bigint;
begin
  select * into v_nomination from public.nominations where id = p_nomination_id;
  if v_nomination is null or v_nomination.status <> 'withdrawn' then
    return;
  end if;

  select * into v_contest from public.contest_periods where id = v_nomination.contest_period_id;
  if v_contest is null or v_contest.level <> 'city' then
    return;
  end if;

  select bm.* into v_matchup
  from public.bracket_matchups bm
  join public.bracket_rounds br on br.id = bm.round_id
  where br.contest_period_id = v_contest.id
    and (bm.nominee_a_id = p_nomination_id or bm.nominee_b_id = p_nomination_id)
  order by br.round_number desc
  limit 1;

  if v_matchup.id is null then
    return;
  end if;

  select * into v_round from public.bracket_rounds where id = v_matchup.round_id;

  if v_round.round_number = 1 and v_round.status = 'pending' then
    -- Cascading promotion: next-highest-seeded gym winner not already here.
    select n.id into v_replacement_id
    from public.contest_periods gym_cp
    join public.nominations n on n.id = gym_cp.winner_id
    join public.gym_locations gl on gl.gym_id = gym_cp.gym_id and gl.is_primary = true
    join public.localities loc on loc.id = gl.locality_id
    join public.cities ci on ci.id = loc.city_id
    where gym_cp.level = 'gym'
      and gym_cp.status = 'completed'
      and gym_cp.gender = v_contest.gender
      and ci.id = v_contest.city_id
      and not exists (
        select 1 from public.nominations existing
        where existing.contest_period_id = v_contest.id
          and existing.source_nomination_id = n.id
      )
    order by public.city_nomination_checkin_count(n.id) desc, n.entry_time asc
    limit 1;

    if v_replacement_id is not null then
      select * into v_source from public.nominations where id = v_replacement_id;

      perform set_config('app.internal_write', 'true', true);
      insert into public.nominations (
        contest_period_id, user_id, primary_photo_url, extra_photo_urls,
        status, consent_accepted_at, entry_time, source_nomination_id
      )
      values (
        v_contest.id, v_source.user_id, v_source.primary_photo_url, v_source.extra_photo_urls,
        'active', v_source.consent_accepted_at, v_source.entry_time, v_source.id
      )
      returning id into v_new_id;
      perform set_config('app.internal_write', 'false', true);

      if v_matchup.nominee_a_id = p_nomination_id then
        update public.bracket_matchups
        set nominee_a_id = v_new_id,
            winner_id = case when winner_id = p_nomination_id then v_new_id else winner_id end
        where id = v_matchup.id;
      else
        update public.bracket_matchups
        set nominee_b_id = v_new_id,
            winner_id = case when winner_id = p_nomination_id then v_new_id else winner_id end
        where id = v_matchup.id;
      end if;
    else
      -- No replacement available - the slot just empties; if this leaves
      -- the matchup with a single side, it resolves as a bye for whoever's
      -- left (or no winner at all if both sides are now empty, which
      -- shouldn't practically happen).
      if v_matchup.nominee_a_id = p_nomination_id then
        update public.bracket_matchups
        set nominee_a_id = null,
            winner_id = case when winner_id = p_nomination_id then nominee_b_id else winner_id end,
            status = case when nominee_b_id is not null then 'completed' else status end
        where id = v_matchup.id;
      else
        update public.bracket_matchups
        set nominee_b_id = null,
            winner_id = case when winner_id = p_nomination_id then nominee_a_id else winner_id end,
            status = case when nominee_a_id is not null then 'completed' else status end
        where id = v_matchup.id;
      end if;
    end if;

  elsif v_matchup.status <> 'completed' then
    -- Voting has started for their round (or this is a later round they
    -- were already placed into): forfeit, opponent auto-advances.
    v_opponent_id := case when v_matchup.nominee_a_id = p_nomination_id
                          then v_matchup.nominee_b_id else v_matchup.nominee_a_id end;

    update public.bracket_matchups
    set status = 'completed', winner_id = v_opponent_id
    where id = v_matchup.id;

    perform public.advance_bracket_round_if_complete(v_matchup.round_id);
  end if;
  -- If the matchup was already 'completed' before this withdrawal, nothing
  -- changes - they're already either eliminated or already advanced, and
  -- any later matchup would have been found by the round_number-desc lookup
  -- above instead.
end;
$function$;

-- Dispatch by level: the same AFTER UPDATE trigger on nominations now
-- serves both gym-level and city-level withdrawals.
create or replace function public.trigger_resolve_gym_withdrawal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_level text;
begin
  if new.status = 'withdrawn' and old.status <> 'withdrawn' then
    select level into v_level from public.contest_periods where id = new.contest_period_id;
    if v_level = 'city' then
      perform public.resolve_city_withdrawal(new.id);
    else
      perform public.resolve_gym_withdrawal(new.id);
    end if;
  end if;
  return new;
end;
$function$;
