create policy "Anyone can view countries" on public.countries for select to anon, authenticated using (true);
create policy "Anyone can view states" on public.states for select to anon, authenticated using (true);
create policy "Anyone can view cities" on public.cities for select to anon, authenticated using (true);
create policy "Anyone can view localities" on public.localities for select to anon, authenticated using (true);
