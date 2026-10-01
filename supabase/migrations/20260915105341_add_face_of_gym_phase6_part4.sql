-- ============================================================
-- resolve_gym_contest - runs when voting closes (manual admin invocation
-- for now, matching the manual contest-creation pattern; no scheduler
-- exists yet to auto-trigger this at voting_end).
--
-- Tiebreaker chain:
--   (a) most votes wins outright
--   (b) tied at the top, and this is the FIRST time (not already a runoff):
--       spin off a child contest_period (status 'runoff', 2-3 day window,
--       parent_contest_period_id set) containing only the tied nominees,
--       and defer this contest_period's own resolution to that runoff.
--   (c) tied again WITHIN a runoff: break by higher count of gym_checkins
--       (is_valid = true) at this gym
--   (d) still tied: earliest entry_time wins
-- ============================================================
create or replace function public.resolve_gym_contest(p_contest_period_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contest public.contest_periods%rowtype;
  v_top_count bigint;
  v_tied_nominees bigint[];
  v_runoff_id bigint;
  v_max_checkins bigint;
  v_checkin_tied bigint[];
  v_winner_nomination_id bigint;
  v_winner_user_id uuid;
  v_parent_winner_id bigint;
begin
  select * into v_contest from public.contest_periods where id = p_contest_period_id;
  if v_contest is null then
    raise exception 'Contest period not found.';
  end if;

  -- Rank every active nominee by vote count (ties share a rank) - used for
  -- display, and so resolve_gym_withdrawal can find the next-highest-ranked
  -- active nominee whenever someone withdraws later.
  with tally as (
    select n.id as nomination_id, count(v.id) as vote_count
    from public.nominations n
    left join public.votes v on v.nominee_id = n.id
    where n.contest_period_id = p_contest_period_id
      and n.status = 'active'
    group by n.id
  ),
  ranked as (
    select nomination_id, rank() over (order by vote_count desc) as rnk
    from tally
  )
  update public.nominations n
  set rank = ranked.rnk
  from ranked
  where n.id = ranked.nomination_id;

  select max(vote_count) into v_top_count
  from (
    select n.id as nomination_id, count(v.id) as vote_count
    from public.nominations n
    left join public.votes v on v.nominee_id = n.id
    where n.contest_period_id = p_contest_period_id
      and n.status = 'active'
    group by n.id
  ) t;

  if v_top_count is null then
    -- No active nominees at all (e.g. everyone withdrew) - nothing to award.
    v_winner_nomination_id := null;
  else
    select array_agg(nomination_id) into v_tied_nominees
    from (
      select n.id as nomination_id, count(v.id) as vote_count
      from public.nominations n
      left join public.votes v on v.nominee_id = n.id
      where n.contest_period_id = p_contest_period_id
        and n.status = 'active'
      group by n.id
    ) t
    where vote_count = v_top_count;

    if array_length(v_tied_nominees, 1) = 1 then
      -- (a) outright winner
      v_winner_nomination_id := v_tied_nominees[1];
    elsif v_contest.status <> 'runoff' then
      -- (b) tied at the top for the first time: spin off a runoff and defer.
      insert into public.contest_periods (
        level, gym_id, gender, nomination_start, nomination_end,
        voting_start, voting_end, status, parent_contest_period_id
      )
      values (
        'gym', v_contest.gym_id, v_contest.gender,
        now(), now(), now(), now() + interval '3 days',
        'runoff', p_contest_period_id
      )
      returning id into v_runoff_id;

      -- Copy the tied nominees into the runoff as fresh rows (new
      -- contest_period_id, vote count naturally resets to zero there).
      -- consent_accepted_at carries forward since this isn't a new
      -- voluntary nomination action, just a continuation of the same one.
      -- The bypass flag is required here: the runoff's status is 'runoff',
      -- not 'nominating', so trg_enforce_nomination_rules would otherwise
      -- reject this system-generated copy.
      perform set_config('app.internal_write', 'true', true);
      insert into public.nominations (
        contest_period_id, user_id, primary_photo_url, extra_photo_urls,
        status, consent_accepted_at, entry_time
      )
      select v_runoff_id, n.user_id, n.primary_photo_url, n.extra_photo_urls,
             'active', n.consent_accepted_at, n.entry_time
      from public.nominations n
      where n.id = any(v_tied_nominees);
      perform set_config('app.internal_write', 'false', true);

      update public.contest_periods set status = 'runoff' where id = p_contest_period_id;
      return;
    else
      -- Already a runoff and it tied again.
      -- (c) break by higher count of valid check-ins at this gym
      select max(checkin_count) into v_max_checkins
      from (
        select n.id as nomination_id,
               (select count(*) from public.gym_checkins c
                where c.user_id = n.user_id and c.gym_id = v_contest.gym_id and c.is_valid = true
               ) as checkin_count
        from public.nominations n
        where n.id = any(v_tied_nominees)
      ) t;

      select array_agg(nomination_id) into v_checkin_tied
      from (
        select n.id as nomination_id,
               (select count(*) from public.gym_checkins c
                where c.user_id = n.user_id and c.gym_id = v_contest.gym_id and c.is_valid = true
               ) as checkin_count
        from public.nominations n
        where n.id = any(v_tied_nominees)
      ) t
      where checkin_count = v_max_checkins;

      if array_length(v_checkin_tied, 1) = 1 then
        v_winner_nomination_id := v_checkin_tied[1];
      else
        -- (d) still tied: earliest entry_time wins
        select id into v_winner_nomination_id
        from public.nominations
        where id = any(v_checkin_tied)
        order by entry_time asc
        limit 1;
      end if;
    end if;
  end if;

  update public.contest_periods
  set status = 'completed', winner_id = v_winner_nomination_id
  where id = p_contest_period_id;

  -- If this WAS a runoff spun off from a parent, propagate the result back
  -- up. The runoff's nominations are copies (same user_id, different
  -- contest_period_id) of the parent's tied nominees, so resolve back to
  -- the ORIGINAL nomination row under the parent contest, not the copy,
  -- so winner_id stays a valid member of the parent's own nominee set.
  if v_contest.parent_contest_period_id is not null then
    if v_winner_nomination_id is not null then
      select user_id into v_winner_user_id from public.nominations where id = v_winner_nomination_id;
      select id into v_parent_winner_id from public.nominations
      where contest_period_id = v_contest.parent_contest_period_id and user_id = v_winner_user_id;
    else
      v_parent_winner_id := null;
    end if;

    update public.contest_periods
    set status = 'completed', winner_id = v_parent_winner_id
    where id = v_contest.parent_contest_period_id;
  end if;
end;
$function$;
