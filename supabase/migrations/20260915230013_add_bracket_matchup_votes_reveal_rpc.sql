-- Reveal rule for bracket matchups (same principle as get_contest_results
-- for gym-level contests, extended to rounds): vote counts stay hidden
-- while a round is voting, and are revealed once THAT ROUND closes - not
-- held back until the whole bracket finishes. Gated on the ROUND's status,
-- not the individual matchup's, so a matchup resolved early via forfeit
-- still doesn't leak its (likely lopsided/zero) count until its sibling
-- matchups in the same round also finish - "each round is its own mini
-- result day," a single synchronized reveal, not staggered per matchup.
-- Never selects voter_id - individual voter identity has no path out
-- through this function.
create or replace function public.get_bracket_matchup_votes(p_matchup_id bigint)
returns table (nominee_id bigint, vote_count bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select n.id as nominee_id, count(bv.id) as vote_count
  from public.bracket_matchups bm
  join public.bracket_rounds br on br.id = bm.round_id
  cross join lateral (values (bm.nominee_a_id), (bm.nominee_b_id)) as sides(nomination_id)
  join public.nominations n on n.id = sides.nomination_id
  left join public.bracket_votes bv on bv.matchup_id = bm.id and bv.nominee_id = n.id
  where bm.id = p_matchup_id
    and br.status = 'completed'
  group by n.id;
$function$;

grant execute on function public.get_bracket_matchup_votes(bigint) to anon, authenticated;
