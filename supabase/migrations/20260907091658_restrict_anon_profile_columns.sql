-- Revoke the broad table-level grant just given, replace with column-scoped grant
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username, full_name) ON public.profiles TO anon;
