create policy "Onboarding submitter can add photos to own pending gym" on public.gym_media
for insert to authenticated
with check (
  exists (
    select 1 from public.gym_onboarding_requests r
    where r.gym_id = gym_media.gym_id
      and r.submitted_by = auth.uid()
      and r.admin_status = 'pending_review'
  )
);

create policy "Onboarding submitter can upload own pending gym photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'gym-photos'
  and exists (
    select 1 from public.gym_onboarding_requests r
    where r.gym_id = (storage.foldername(name))[1]::bigint
      and r.submitted_by = auth.uid()
      and r.admin_status = 'pending_review'
  )
);
