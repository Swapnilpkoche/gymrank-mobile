-- Bug fix: the loop record never selected round_id, so the subsequent
-- advance_bracket_round_if_complete(v_matchup.round_id) call always failed
-- with "record has no field round_id" - no matchup resolution ever actually
-- completed successfully.
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
    select bm.id, bm.round_id, bm.nominee_a_id, bm.nominee_b_id
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
