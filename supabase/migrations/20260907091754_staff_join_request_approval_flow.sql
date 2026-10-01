-- 1. Widen role values: add 'trainer', keep 'staff' as generic fallback
ALTER TABLE public.gym_staff DROP CONSTRAINT gym_staff_role_check;
ALTER TABLE public.gym_staff ADD CONSTRAINT gym_staff_role_check
  CHECK (role = ANY (ARRAY['owner','admin','manager','staff','trainer']));

-- 2. Widen status values: add 'pending', 'rejected'
ALTER TABLE public.gym_staff DROP CONSTRAINT gym_staff_status_check;
ALTER TABLE public.gym_staff ADD CONSTRAINT gym_staff_status_check
  CHECK (status = ANY (ARRAY['active','suspended','removed','pending','rejected']));

-- 3. Audit columns for the approve/reject decision
ALTER TABLE public.gym_staff
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Gym-level admin check (owner/admin only, unlike is_staff_of_gym which is any active member)
CREATE OR REPLACE FUNCTION public.is_gym_admin(target_gym_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_staff
    WHERE user_id = auth.uid()
      AND gym_id = target_gym_id
      AND status = 'active'
      AND role IN ('owner','admin')
  );
$function$;

-- 5. Base table privileges (anon currently has no grant at all on gym_staff)
GRANT SELECT ON public.gym_staff TO anon;
GRANT INSERT, UPDATE, DELETE ON public.gym_staff TO authenticated;

-- 6. RLS: self-service join request
CREATE POLICY "Users can request to join a gym staff"
ON public.gym_staff
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND role IN ('admin','manager','staff','trainer')
  AND invited_by IS NULL
);

-- 7. RLS: requester can cancel a pending request or clear a rejected one
CREATE POLICY "Users can remove their own pending or rejected request"
ON public.gym_staff
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND status IN ('pending','rejected')
);

-- 8. RLS: gym owner/admin approves or rejects a pending request
CREATE POLICY "Gym admins can approve or reject staff requests"
ON public.gym_staff
FOR UPDATE
TO authenticated
USING (
  is_gym_admin(gym_id) AND status = 'pending'
)
WITH CHECK (
  is_gym_admin(gym_id)
  AND status IN ('active','rejected')
  AND responded_by = auth.uid()
  AND responded_at IS NOT NULL
);

-- 9. RLS: public visibility of active staff only (for the gym detail page)
CREATE POLICY "Anyone can view active gym staff"
ON public.gym_staff
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- 10. Tighten team visibility: non-admin active staff see only active rows;
--     owner/admin see everything for their gym, including pending/rejected
ALTER POLICY "Staff can view their gym's team"
ON public.gym_staff
USING (
  (status = 'active' AND is_staff_of_gym(gym_id))
  OR is_gym_admin(gym_id)
);
