-- Table-level privileges are required independently of RLS policies - a
-- policy alone doesn't grant the underlying SQL privilege. message_threads
-- and messages need these to be usable at all; profile_media was missing
-- UPDATE entirely since Phase 2 added the visibility-toggle policy but not
-- the matching grant.
grant select, insert, delete on public.message_threads to authenticated;
grant select, insert on public.messages to authenticated;
grant update on public.profile_media to authenticated;
