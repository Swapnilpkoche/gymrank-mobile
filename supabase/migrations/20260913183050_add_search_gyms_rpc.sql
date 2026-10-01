create or replace function public.search_gyms(search_term text)
returns table (
  id bigint,
  name text,
  slug text,
  description text,
  status text,
  verification_status text,
  location text,
  city text,
  state text,
  country text,
  category text,
  latitude double precision,
  longitude double precision
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    g.id,
    g.name,
    g.slug,
    g.description,
    g.status,
    g.verification_status,
    g.location,
    coalesce(ci.name, g.city) as city,
    coalesce(st.name, g.state) as state,
    coalesce(co.name, g.country) as country,
    g.category,
    g.latitude,
    g.longitude
  from public.gyms g
  left join public.gym_locations gl on gl.gym_id = g.id and gl.is_primary
  left join public.localities loc on loc.id = gl.locality_id
  left join public.cities ci on ci.id = loc.city_id
  left join public.states st on st.id = ci.state_id
  left join public.countries co on co.id = st.country_id
  where g.status = 'active'
    and (
      g.name ilike '%' || search_term || '%'
      or g.location ilike '%' || search_term || '%'
      or g.city ilike '%' || search_term || '%'
      or g.state ilike '%' || search_term || '%'
      or g.country ilike '%' || search_term || '%'
      or loc.name ilike '%' || search_term || '%'
      or ci.name ilike '%' || search_term || '%'
      or st.name ilike '%' || search_term || '%'
      or co.name ilike '%' || search_term || '%'
    )
  order by g.name
  limit 20;
$function$;

grant execute on function public.search_gyms(text) to anon, authenticated;
