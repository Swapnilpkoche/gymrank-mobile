-- Aggregated vote counts per nominee, visible to anyone, but only once the
-- contest is 'completed' (returns no rows otherwise - no bandwagon effect
-- during active voting). Deliberately never selects votes.voter_id or
-- anything derived from it - individual voter identity stays permanently
-- hidden behind votes' own RLS (voter can only see their own row) and this
-- function's column list.
create or replace function public.get_contest_results(p_contest_period_id bigint)
returns table (nomination_id bigint, vote_count bigint, rank integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select n.id as nomination_id, count(v.id) as vote_count, n.rank
  from public.nominations n
  left join public.votes v on v.nominee_id = n.id
  where n.contest_period_id = p_contest_period_id
    and n.status = 'active'
    and exists (
      select 1 from public.contest_periods cp
      where cp.id = p_contest_period_id and cp.status = 'completed'
    )
  group by n.id, n.rank
  order by vote_count desc, n.entry_time asc;
$function$;

grant execute on function public.get_contest_results(bigint) to anon, authenticated;
