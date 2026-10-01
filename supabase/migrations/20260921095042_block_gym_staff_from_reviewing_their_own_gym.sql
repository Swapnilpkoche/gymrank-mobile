-- Review integrity: anyone with an ACTIVE gym_staff row at a gym (any role - owner, admin,
-- manager, staff, trainer) can't post a review of that gym. Previously the only check was
-- auth.uid() = user_id, so the app hiding the button was the only thing stopping it.
--
-- is_staff_of_gym() is the project's existing "active staff of this gym, any role" check.
-- Applies to NEW reviews only; existing reviews are untouched. Pending/rejected/removed
-- staff rows don't count as affiliation.
drop policy "Users can create their own reviews" on public.gym_reviews;

create policy "Users can review gyms they are not active staff of"
  on public.gym_reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not public.is_staff_of_gym(gym_id)
  );
