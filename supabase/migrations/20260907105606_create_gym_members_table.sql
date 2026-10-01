create table public.gym_members (
  id bigint generated always as identity primary key,
  gym_id bigint not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','active','rejected','removed')),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

alter table public.gym_members enable row level security;

grant select, insert, update, delete on public.gym_members to authenticated;

create policy "Users can view their own membership record"
  on public.gym_members for select
  to authenticated
  using (user_id = auth.uid());

create policy "Gym staff can view their gym's members"
  on public.gym_members for select
  to authenticated
  using (is_staff_of_gym(gym_id) or is_gym_admin(gym_id));

create policy "Users can request to join a gym as a member"
  on public.gym_members for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "Gym admins can approve or reject member requests"
  on public.gym_members for update
  to authenticated
  using (is_gym_admin(gym_id) and status = 'pending')
  with check (
    is_gym_admin(gym_id)
    and status in ('active','rejected')
    and responded_by = auth.uid()
    and responded_at is not null
  );

create policy "Users can remove their own pending or rejected request"
  on public.gym_members for delete
  to authenticated
  using (user_id = auth.uid() and status in ('pending','rejected'));
