-- Guests (anon) can no longer see a minor's album, matching
-- get_public_profile / search_profiles. "Minor" = is_adult() false,
-- which also covers a missing date_of_birth. Signed-in users unchanged.

-- 1. profile_media rows
drop policy "Anyone can view profile media" on public.profile_media;

create policy "Signed-in users can view profile media"
  on public.profile_media for select to authenticated
  using (true);

create policy "Guests can view adults' profile media"
  on public.profile_media for select to anon
  using (public.is_adult(user_id));

-- 2. profile-media bucket: stop guests listing a minor's folder.
-- The CASE guards the uuid cast so an unexpected folder name returns
-- false instead of erroring the whole query.
drop policy "Anyone can view profile media files" on storage.objects;

create policy "Signed-in users can view profile media files"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-media');

create policy "Guests can view adults' profile media files"
  on storage.objects for select to anon
  using (
    bucket_id = 'profile-media'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.is_adult(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
