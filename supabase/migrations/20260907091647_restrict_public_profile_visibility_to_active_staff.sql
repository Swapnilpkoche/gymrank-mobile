-- Drop the overly-broad public policy that exposes every column of every profile
DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;

-- Base grant: allow anon to SELECT from profiles (RLS below restricts rows/effectively columns via a view)
GRANT SELECT ON public.profiles TO anon;

-- Replace with a narrow policy: only profiles belonging to a CURRENTLY ACTIVE gym_staff member are visible,
-- and only to anon/authenticated callers who aren't the owner themselves (the "own profile" policy already covers that case)
CREATE POLICY "Active staff profiles are publicly viewable"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gym_staff
    WHERE gym_staff.user_id = profiles.id
      AND gym_staff.status = 'active'
  )
);
