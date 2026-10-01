create policy "Users can view their own day notes"
  on public.gym_day_notes for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create their own day notes"
  on public.gym_day_notes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own day notes"
  on public.gym_day_notes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own day notes"
  on public.gym_day_notes for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.gym_day_notes from anon;
