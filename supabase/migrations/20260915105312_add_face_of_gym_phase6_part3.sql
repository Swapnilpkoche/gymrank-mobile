-- ============================================================
-- Withdrawal -> cascading promotion
-- ============================================================
-- Called automatically (via trigger below) whenever a nomination's status
-- flips to 'withdrawn'. Only does something once a winner_id has already
-- been decided for this contest_period (before that, withdrawing just
-- removes a candidate from the still-open pool - resolve_gym_contest will
-- naturally only count remaining active nominees when it eventually runs).
create or replace function public.resolve_gym_withdrawal(p_nomination_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nomination public.nominations%rowtype;
  v_contest public.contest_periods%rowtype;
  v_next public.nominations%rowtype;
begin
  select * into v_nomination from public.nominations where id = p_nomination_id;
  if v_nomination is null or v_nomination.status <> 'withdrawn' then
    return;
  end if;

  select * into v_contest from public.contest_periods where id = v_nomination.contest_period_id;
  if v_contest is null then
    return;
  end if;

  -- TODO(Phase 7): before promoting, check whether this contest_period's
  -- current winner has already been placed into an active City-level
  -- bracket_matchups row. If so, the gym-level seat is locked and no
  -- promotion should happen even though winner_id still points at the
  -- withdrawn nomination. That table doesn't exist yet, so for now
  -- promotion always proceeds whenever the withdrawing nominee held the
  -- winner_id slot.
  if v_contest.winner_id = p_nomination_id then
    -- status = 'active' already excludes anyone who has withdrawn, so the
    -- best-ranked remaining row here is automatically the correct next
    -- promotion regardless of how many people ahead of them already
    -- withdrew - no separate recursive cascade needed.
    select * into v_next
    from public.nominations
    where contest_period_id = v_contest.id
      and status = 'active'
      and id <> p_nomination_id
    order by rank asc nulls last, entry_time asc
    limit 1;

    update public.contest_periods
    set winner_id = v_next.id
    where id = v_contest.id;
  end if;
end;
$function$;

create or replace function public.trigger_resolve_gym_withdrawal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'withdrawn' and old.status <> 'withdrawn' then
    perform public.resolve_gym_withdrawal(new.id);
  end if;
  return new;
end;
$function$;

create trigger trg_after_nomination_withdrawn
  after update on public.nominations
  for each row
  execute function public.trigger_resolve_gym_withdrawal();

-- ============================================================
-- Storage: gym-face-nominations (public - contests are public-facing)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gym-face-nominations', 'gym-face-nominations', true)
on conflict (id) do nothing;

create policy "Anyone can view face-of-gym nomination photos"
on storage.objects for select
using (bucket_id = 'gym-face-nominations');

create policy "Users can upload their own nomination photos"
on storage.objects for insert
with check (
  bucket_id = 'gym-face-nominations'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own nomination photos"
on storage.objects for delete
using (
  bucket_id = 'gym-face-nominations'
  and (storage.foldername(name))[1] = auth.uid()::text
);
