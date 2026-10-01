-- Gym owner onboarding: submission + admin review + document upload + email confirmation

create table public.gym_onboarding_requests (
  id bigint generated always as identity primary key,
  gym_id bigint not null references public.gyms(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  admin_status text not null default 'pending_review' check (admin_status in ('pending_review','verified','rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  confirmation_token_hash text unique,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gym_onboarding_requests_gym_id_idx on public.gym_onboarding_requests(gym_id);
create index gym_onboarding_requests_submitted_by_idx on public.gym_onboarding_requests(submitted_by);
create index gym_onboarding_requests_admin_status_idx on public.gym_onboarding_requests(admin_status);

create table public.gym_onboarding_documents (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.gym_onboarding_requests(id) on delete cascade,
  document_type text not null check (document_type in ('business_registration','id_proof','lease_agreement','other')),
  file_path text not null,
  uploaded_at timestamptz not null default now()
);

create index gym_onboarding_documents_request_id_idx on public.gym_onboarding_documents(request_id);

alter table public.gym_onboarding_requests enable row level security;
alter table public.gym_onboarding_documents enable row level security;

-- Requests: owner can see/insert their own; admin sees/updates all
create policy "Owner can view own onboarding request"
  on public.gym_onboarding_requests for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

create policy "Owner can create own onboarding request"
  on public.gym_onboarding_requests for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "Admin can update onboarding requests"
  on public.gym_onboarding_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on public.gym_onboarding_requests to authenticated;
grant update on public.gym_onboarding_requests to authenticated;
grant usage, select on sequence public.gym_onboarding_requests_id_seq to authenticated;

-- Documents: owner can upload (insert) linked to their own request, cannot read back; admin can read all
create policy "Owner can upload documents to own request"
  on public.gym_onboarding_documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.gym_onboarding_requests r
      where r.id = request_id and r.submitted_by = auth.uid()
    )
  );

create policy "Admin can view all onboarding documents"
  on public.gym_onboarding_documents for select
  to authenticated
  using (public.is_admin());

grant select, insert on public.gym_onboarding_documents to authenticated;
grant usage, select on sequence public.gym_onboarding_documents_id_seq to authenticated;

-- Private storage bucket for onboarding documents (not publicly accessible)
insert into storage.buckets (id, name, public)
values ('gym-onboarding-docs', 'gym-onboarding-docs', false)
on conflict (id) do nothing;

create policy "Owner can upload own onboarding files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gym-onboarding-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admin can view onboarding files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gym-onboarding-docs'
    and public.is_admin()
  );
