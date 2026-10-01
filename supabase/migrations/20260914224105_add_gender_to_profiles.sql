alter table public.profiles
  add column gender text;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender = any (array['male', 'female', 'non_binary', 'prefer_not_to_say']));
