insert into storage.buckets (id, name, public)
values ('gym-photos', 'gym-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view gym photos" on storage.objects
for select to anon, authenticated
using (bucket_id = 'gym-photos');

create policy "Gym admins can upload gym photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'gym-photos'
  and is_gym_admin((storage.foldername(name))[1]::bigint)
);
