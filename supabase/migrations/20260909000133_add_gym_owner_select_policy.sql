create policy "Owners can view their own gym" on public.gyms
for select to authenticated
using (created_by = auth.uid());
