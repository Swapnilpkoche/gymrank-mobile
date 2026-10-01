CREATE OR REPLACE FUNCTION public.submit_gym_onboarding(
  p_name text,
  p_category text,
  p_phone text,
  p_city text,
  p_state text,
  p_country text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_landmark text,
  p_postal_code text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
 RETURNS TABLE(gym_id bigint, request_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gym_id bigint;
  v_request_id bigint;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

  insert into public.gyms (name, slug, status, verification_status, created_by, category, phone, city, state, country, latitude, longitude)
  values (p_name, v_slug, 'draft', 'claimed', auth.uid(), p_category, p_phone, p_city, p_state, p_country, p_latitude, p_longitude)
  returning id into v_gym_id;

  insert into public.gym_locations (gym_id, address_line_1, address_line_2, landmark, postal_code, phone, latitude, longitude, is_primary, status)
  values (v_gym_id, p_address_line_1, nullif(p_address_line_2, ''), nullif(p_landmark, ''), nullif(p_postal_code, ''), p_phone, p_latitude, p_longitude, true, 'active');

  -- No gym_staff row is created here. Owner-dashboard access (an active
  -- 'owner' gym_staff row) must only be granted by the confirmation-link
  -- handling step, after admin verification and the owner's email click.
  insert into public.gym_onboarding_requests (gym_id, submitted_by, admin_status)
  values (v_gym_id, auth.uid(), 'pending_review')
  returning id into v_request_id;

  return query select v_gym_id, v_request_id;
end;
$function$;
