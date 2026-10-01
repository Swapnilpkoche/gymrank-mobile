-- 1. Visibility flag on profile_media rows
alter table public.profile_media
  add column visibility text not null default 'public';

alter table public.profile_media
  add constraint profile_media_visibility_check
  check (visibility in ('public', 'private'));

-- profile_media had no UPDATE policy at all before this - required for the
-- visibility toggle (item 4/6) to be able to write to its own rows.
create policy "Users can update their own media"
on public.profile_media
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 2. New PRIVATE bucket - existing "profile-media" bucket and its contents
-- are untouched.
insert into storage.buckets (id, name, public)
values ('profile-media-private', 'profile-media-private', false)
on conflict (id) do nothing;

-- 3. Mutual-follow helper, same pattern as is_adult(): SECURITY DEFINER so it
-- doesn't depend on the calling session's own RLS view of user_follows, and
-- it's usable directly inside a storage policy expression.
create or replace function public.is_mutual_follow(user_a uuid, user_b uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.user_follows
    where follower_id = user_a and followed_id = user_b
  )
  and exists (
    select 1 from public.user_follows
    where follower_id = user_b and followed_id = user_a
  );
$function$;

grant execute on function public.is_mutual_follow(uuid, uuid) to anon, authenticated;

-- 4. Storage RLS on the private bucket. File paths are "${uploaderId}/...",
-- same layout as the existing profile-media bucket, so folder[1] is always
-- the uploader's id.
create policy "Uploader or mutual follower can view private profile media"
on storage.objects for select
using (
  bucket_id = 'profile-media-private'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_mutual_follow(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

create policy "Users can upload their own private profile media files"
on storage.objects for insert
with check (
  bucket_id = 'profile-media-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own private profile media files"
on storage.objects for delete
using (
  bucket_id = 'profile-media-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);
