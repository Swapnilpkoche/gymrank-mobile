alter table public.profiles
  add column if not exists follow_limit int not null default 25,
  add column if not exists follower_limit int not null default 100;

create table public.user_follows (
  id bigint generated always as identity primary key,
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index user_follows_follower_idx on public.user_follows(follower_id);
create index user_follows_followed_idx on public.user_follows(followed_id);

alter table public.user_follows enable row level security;

create policy "Users can view relationships they are part of"
  on public.user_follows for select
  to authenticated
  using (follower_id = auth.uid() or followed_id = auth.uid());

create policy "Users can follow others"
  on public.user_follows for insert
  to authenticated
  with check (follower_id = auth.uid());

create policy "Users can unfollow"
  on public.user_follows for delete
  to authenticated
  using (follower_id = auth.uid());

grant select, insert, delete on public.user_follows to authenticated;
grant usage, select on sequence public.user_follows_id_seq to authenticated;

create or replace function public.enforce_follow_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_follower_count int;
  v_follower_limit int;
  v_following_count int;
  v_follow_limit int;
begin
  select count(*) into v_following_count from public.user_follows where follower_id = new.follower_id;
  select follow_limit into v_follow_limit from public.profiles where id = new.follower_id;

  if v_following_count >= coalesce(v_follow_limit, 25) then
    raise exception 'You can follow up to % members on the free plan. Upgrade to follow more.', coalesce(v_follow_limit, 25);
  end if;

  select count(*) into v_follower_count from public.user_follows where followed_id = new.followed_id;
  select follower_limit into v_follower_limit from public.profiles where id = new.followed_id;

  if v_follower_count >= coalesce(v_follower_limit, 100) then
    raise exception 'This member has reached their follower limit.';
  end if;

  return new;
end;
$function$;

create trigger trg_enforce_follow_limits
  before insert on public.user_follows
  for each row execute function public.enforce_follow_limits();

-- allow anyone to look up basic public profile info (name/avatar) by id for the profile-view screen
grant select (id, full_name, username, avatar_url, bio) on public.profiles to authenticated;
