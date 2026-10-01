create view public.gym_member_counts
with (security_invoker = false) as
select gym_id, count(*)::bigint as active_member_count
from public.gym_members
where status = 'active'
group by gym_id;

grant select on public.gym_member_counts to anon, authenticated;
