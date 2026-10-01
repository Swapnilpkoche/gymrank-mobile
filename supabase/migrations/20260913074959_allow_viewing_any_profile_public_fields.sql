create policy "Any authenticated user can view basic public profile fields"
  on public.profiles for select
  to authenticated
  using (true);
