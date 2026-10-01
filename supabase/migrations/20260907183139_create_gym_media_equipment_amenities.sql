create table public.gym_media (
  id bigint generated always as identity primary key,
  gym_id bigint not null references public.gyms(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  role text not null default 'gallery' check (role in ('hero','logo','gallery')),
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index gym_media_one_hero_per_gym on public.gym_media (gym_id) where role = 'hero';
create unique index gym_media_one_logo_per_gym on public.gym_media (gym_id) where role = 'logo';

create table public.gym_equipment (
  id bigint generated always as identity primary key,
  gym_id bigint not null references public.gyms(id) on delete cascade,
  name text not null,
  unique (gym_id, name)
);

create table public.gym_amenities (
  id bigint generated always as identity primary key,
  gym_id bigint not null references public.gyms(id) on delete cascade,
  name text not null,
  unique (gym_id, name)
);

alter table public.gym_media enable row level security;
alter table public.gym_equipment enable row level security;
alter table public.gym_amenities enable row level security;

grant select on public.gym_media to anon, authenticated;
grant insert, update, delete on public.gym_media to authenticated;

grant select on public.gym_equipment to anon, authenticated;
grant insert, update, delete on public.gym_equipment to authenticated;

grant select on public.gym_amenities to anon, authenticated;
grant insert, update, delete on public.gym_amenities to authenticated;

create policy "Anyone can view gym media" on public.gym_media
  for select to anon, authenticated using (true);
create policy "Gym admins can manage gym media" on public.gym_media
  for all to authenticated using (is_gym_admin(gym_id)) with check (is_gym_admin(gym_id));

create policy "Anyone can view gym equipment" on public.gym_equipment
  for select to anon, authenticated using (true);
create policy "Gym admins can manage gym equipment" on public.gym_equipment
  for all to authenticated using (is_gym_admin(gym_id)) with check (is_gym_admin(gym_id));

create policy "Anyone can view gym amenities" on public.gym_amenities
  for select to anon, authenticated using (true);
create policy "Gym admins can manage gym amenities" on public.gym_amenities
  for all to authenticated using (is_gym_admin(gym_id)) with check (is_gym_admin(gym_id));
