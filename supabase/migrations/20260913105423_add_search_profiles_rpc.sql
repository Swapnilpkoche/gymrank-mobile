create or replace function public.search_profiles(p_query text)
returns table(id uuid, full_name text, username text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $function$
  select p.id, p.full_name, p.username, p.avatar_url
  from public.profiles p
  where p.full_name ilike '%' || p_query || '%'
     or p.username ilike '%' || p_query || '%'
  order by p.full_name
  limit 20;
$function$;

grant execute on function public.search_profiles(text) to authenticated;
