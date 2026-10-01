create table public.message_thread_reads (
  thread_id    bigint      not null references public.message_threads(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.message_thread_reads enable row level security;
revoke all on public.message_thread_reads from anon, authenticated;
grant select on public.message_thread_reads to authenticated;

create policy "Users read their own thread read markers"
  on public.message_thread_reads
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.mark_message_thread_read(p_thread_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if not exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id and v_uid in (t.user_a, t.user_b)
  ) then
    raise exception 'You are not a participant in this conversation.';
  end if;
  insert into public.message_thread_reads (thread_id, user_id, last_read_at)
  values (p_thread_id, v_uid, now())
  on conflict (thread_id, user_id)
  do update set last_read_at = greatest(message_thread_reads.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_message_thread_read(bigint) from public, anon;
grant execute on function public.mark_message_thread_read(bigint) to authenticated;

create or replace function public.get_unread_message_counts()
returns table (thread_id bigint, unread_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select m.thread_id, count(*)::integer
  from public.messages m
  join public.message_threads t on t.id = m.thread_id
  left join public.message_thread_reads r
    on r.thread_id = m.thread_id and r.user_id = (select auth.uid())
  where (select auth.uid()) in (t.user_a, t.user_b)
    and t.reported_at is null
    and m.sender_id <> (select auth.uid())
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by m.thread_id
$$;

revoke all on function public.get_unread_message_counts() from public, anon;
grant execute on function public.get_unread_message_counts() to authenticated;

alter publication supabase_realtime add table public.messages;
