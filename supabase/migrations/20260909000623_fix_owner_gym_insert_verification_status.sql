drop policy "Users can create their own draft gym" on public.gyms;

create policy "Users can create their own draft gym"
  on public.gyms for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and status = 'draft'
    and verification_status = 'claimed'
  );
