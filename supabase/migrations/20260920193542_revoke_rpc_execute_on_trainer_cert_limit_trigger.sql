-- Trigger-only function: nothing should call it via /rest/v1/rpc. Firing a trigger
-- doesn't require EXECUTE for the invoking role.
revoke execute on function public.enforce_trainer_certification_limit() from public, anon, authenticated;
