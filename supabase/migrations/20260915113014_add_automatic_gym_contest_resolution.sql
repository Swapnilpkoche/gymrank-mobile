-- Runs periodically via pg_cron to resolve any contest_period whose voting
-- window has closed, replacing manual resolve_gym_contest invocation.
create or replace function public.run_pending_gym_contest_resolutions()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id bigint;
begin
  for v_id in
    select cp.id
    from public.contest_periods cp
    where cp.status in ('voting', 'runoff')
      and cp.voting_end <= now()
      -- Skip a contest_period that is itself waiting on an already-spun-off
      -- runoff child (status = 'runoff', no parent of its own, but a child
      -- exists pointing back at it via parent_contest_period_id). It will
      -- resolve automatically once that child finishes, via
      -- resolve_gym_contest's propagate-to-parent step. Re-invoking it
      -- directly here would re-tally the same already-tied vote count and
      -- could prematurely resolve it via the check-in tiebreak before its
      -- own runoff has actually been voted on.
      and not exists (
        select 1 from public.contest_periods child
        where child.parent_contest_period_id = cp.id
      )
  loop
    perform public.resolve_gym_contest(v_id);
  end loop;
end;
$function$;

select cron.schedule(
  'resolve-gym-contests',
  '*/10 * * * *',
  $$select public.run_pending_gym_contest_resolutions();$$
);
