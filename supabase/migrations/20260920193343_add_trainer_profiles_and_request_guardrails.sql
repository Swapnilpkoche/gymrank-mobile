-- ============ 1. trainer_profiles ============
create table public.trainer_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  bio              text,
  specialties      text[] not null default '{}',
  years_experience smallint,
  photo_path       text,                      -- path inside the public trainer-photos bucket
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint trainer_profiles_bio_len check (bio is null or char_length(bio) <= 1000),
  constraint trainer_profiles_specialties_size check (
    cardinality(specialties) <= 10 and char_length(array_to_string(specialties, ',')) <= 300),
  constraint trainer_profiles_years_range check (
    years_experience is null or years_experience between 0 and 60),
  constraint trainer_profiles_photo_owner check (
    photo_path is null or starts_with(photo_path, user_id::text || '/'))
);

create or replace function public.trainer_profiles_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;

create trigger trg_trainer_profiles_updated_at
  before update on public.trainer_profiles
  for each row execute function public.trainer_profiles_set_updated_at();

alter table public.trainer_profiles enable row level security;
grant select on public.trainer_profiles to anon, authenticated;
grant insert, update, delete on public.trainer_profiles to authenticated;

create policy "Anyone can view trainer profiles"
  on public.trainer_profiles for select to anon, authenticated using (true);

create policy "Adults can create their own trainer profile"
  on public.trainer_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_adult((select auth.uid())));

create policy "Adults can update their own trainer profile"
  on public.trainer_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_adult((select auth.uid())));

create policy "Trainers can delete their own trainer profile"
  on public.trainer_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============ 2. trainer_certifications ============
create table public.trainer_certifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.trainer_profiles(user_id) on delete cascade,
  title        text not null,
  issuing_body text not null,
  photo_path   text,                          -- optional; lives in the PRIVATE trainer-certificates bucket
  created_at   timestamptz not null default now(),
  constraint trainer_certs_title_len  check (char_length(btrim(title)) between 1 and 120),
  constraint trainer_certs_issuer_len check (char_length(btrim(issuing_body)) between 1 and 120),
  constraint trainer_certs_photo_owner check (
    photo_path is null or starts_with(photo_path, user_id::text || '/'))
);
create index trainer_certifications_user_id_idx on public.trainer_certifications (user_id);

create or replace function public.enforce_trainer_certification_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trainer_certifications where user_id = new.user_id) >= 10 then
    raise exception 'You can add up to 10 certifications.';
  end if;
  return new;
end; $$;

create trigger trg_enforce_trainer_certification_limit
  before insert on public.trainer_certifications
  for each row execute function public.enforce_trainer_certification_limit();

alter table public.trainer_certifications enable row level security;
grant select on public.trainer_certifications to anon, authenticated;
grant insert, update, delete on public.trainer_certifications to authenticated;

create policy "Anyone can view trainer certifications"
  on public.trainer_certifications for select to anon, authenticated using (true);

create policy "Adults can add their own certifications"
  on public.trainer_certifications for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_adult((select auth.uid())));

create policy "Adults can update their own certifications"
  on public.trainer_certifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_adult((select auth.uid())));

create policy "Trainers can delete their own certifications"
  on public.trainer_certifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============ 3. storage ============
-- Public bucket: profile photos only.   path: <uid>/profile-<ts>.<ext>
-- Private bucket: certificate photos.    path: <uid>/<ts>.<ext>   (read via signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('trainer-photos',       'trainer-photos',       true,  5242880,
    array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('trainer-certificates', 'trainer-certificates', false, 5242880,
    array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

-- trainer-photos (public)
create policy "Anyone can view trainer photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'trainer-photos');

create policy "Adults can upload their own trainer photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trainer-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_adult((select auth.uid())));

create policy "Adults can update their own trainer photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'trainer-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'trainer-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_adult((select auth.uid())));

create policy "Users can delete their own trainer photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trainer-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- trainer-certificates (private): readable by the owner, and by owners/admins of any gym
-- where that trainer has a pending or active staff row (so they can review credentials).
create policy "Owner and reviewing gym admins can view trainer certificates"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trainer-certificates'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.gym_staff gs
        where gs.user_id::text = (storage.foldername(name))[1]
          and gs.status in ('pending', 'active')
          and public.is_gym_admin(gs.gym_id)
      )
    )
  );

create policy "Adults can upload their own trainer certificates"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trainer-certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_adult((select auth.uid())));

create policy "Adults can update their own trainer certificates"
  on storage.objects for update to authenticated
  using (bucket_id = 'trainer-certificates' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'trainer-certificates'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_adult((select auth.uid())));

create policy "Users can delete their own trainer certificates"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trainer-certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============ 4. request-flow guardrails on gym_staff ============
drop policy "Users can request to join a gym staff" on public.gym_staff;

create policy "Adult trainers can request to join a gym"
  on public.gym_staff for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and role = 'trainer'                                   -- (b) trainer only
    and invited_by is null
    and responded_by is null
    and responded_at is null
    and public.is_adult((select auth.uid()))               -- (a) block minors
    and exists (select 1 from public.trainer_profiles tp   -- hard-require a trainer profile
                where tp.user_id = (select auth.uid()))
  );

-- Lock identity/role fields while a request is pending, so approval can only
-- flip status - an approver can never change the requested role.
create or replace function public.lock_pending_staff_request_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'pending' and (
       new.role       is distinct from old.role
    or new.user_id    is distinct from old.user_id
    or new.gym_id     is distinct from old.gym_id
    or new.invited_by is distinct from old.invited_by
  ) then
    raise exception 'A pending staff request''s role, user and gym cannot be changed. Approve or reject it as submitted.'
      using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger trg_lock_pending_staff_request_fields
  before update on public.gym_staff
  for each row execute function public.lock_pending_staff_request_fields();

-- ============ 5. pending-requests list for gym admins ============
create or replace function public.get_gym_staff_requests(p_gym_id bigint)
returns table (
  request_id bigint, requester_id uuid, requested_role text, requested_at timestamptz,
  full_name text, username text, avatar_url text,
  trainer_bio text, specialties text[], years_experience smallint,
  certification_count integer)
language sql stable security definer set search_path = public as $$
  select gs.id, gs.user_id, gs.role, gs.created_at,
         p.full_name, p.username, p.avatar_url,
         tp.bio, tp.specialties, tp.years_experience,
         (select count(*)::int from public.trainer_certifications tc where tc.user_id = gs.user_id)
  from public.gym_staff gs
  left join public.profiles p on p.id = gs.user_id
  left join public.trainer_profiles tp on tp.user_id = gs.user_id
  where gs.gym_id = p_gym_id
    and gs.status = 'pending'
    and public.is_gym_admin(p_gym_id)               -- returns nothing for non-admins
  order by gs.created_at;
$$;

revoke all on function public.get_gym_staff_requests(bigint) from public, anon;
grant execute on function public.get_gym_staff_requests(bigint) to authenticated;
