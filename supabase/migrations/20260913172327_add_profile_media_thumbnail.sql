alter table public.profile_media
  add column if not exists thumbnail_path text;
