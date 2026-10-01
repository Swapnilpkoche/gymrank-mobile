alter table public.profiles
  add column if not exists photo_limit int not null default 5,
  add column if not exists video_limit int not null default 3;

create table public.profile_media (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  file_path text not null,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create index profile_media_user_id_idx on public.profile_media(user_id);

alter table public.profile_media enable row level security;

create policy "Anyone can view profile media"
  on public.profile_media for select
  to anon, authenticated
  using (true);

create policy "Users can upload their own media"
  on public.profile_media for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own media"
  on public.profile_media for delete
  to authenticated
  using (user_id = auth.uid());

grant select on public.profile_media to anon;
grant select, insert, delete on public.profile_media to authenticated;
grant usage, select on sequence public.profile_media_id_seq to authenticated;

create or replace function public.enforce_media_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count int;
  v_limit int;
begin
  select count(*) into v_count from public.profile_media
  where user_id = new.user_id and media_type = new.media_type;

  if new.media_type = 'photo' then
    select photo_limit into v_limit from public.profiles where id = new.user_id;
    if v_count >= coalesce(v_limit, 5) then
      raise exception 'You can upload up to % photos on the free plan. Upgrade to add more.', coalesce(v_limit, 5);
    end if;
  else
    select video_limit into v_limit from public.profiles where id = new.user_id;
    if v_count >= coalesce(v_limit, 3) then
      raise exception 'You can upload up to % videos on the free plan. Upgrade to add more.', coalesce(v_limit, 3);
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_enforce_media_limits
  before insert on public.profile_media
  for each row execute function public.enforce_media_limits();

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do nothing;

create policy "Anyone can view profile media files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-media');

create policy "Users can upload their own profile media files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own profile media files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
