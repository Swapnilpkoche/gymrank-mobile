CREATE OR REPLACE FUNCTION public.checkin_to_gym(p_gym_id bigint, p_user_latitude double precision, p_user_longitude double precision)
 RETURNS TABLE(success boolean, message text, distance_meters double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
  nearest_location_id bigint;
  nearest_distance double precision;
  earth_radius_meters constant double precision := 6371000;
  is_checkin_valid boolean;
BEGIN
  -- Find the nearest active location for this gym, using Haversine distance
  SELECT gl.id,
    earth_radius_meters * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(gl.latitude)) * cos(radians(p_user_latitude)) *
        cos(radians(p_user_longitude) - radians(gl.longitude)) +
        sin(radians(gl.latitude)) * sin(radians(p_user_latitude))
      ))
    ) AS distance
  INTO nearest_location_id, nearest_distance
  FROM public.gym_locations gl
  WHERE gl.gym_id = p_gym_id
    AND gl.status = 'active'
    AND gl.latitude IS NOT NULL
    AND gl.longitude IS NOT NULL
  ORDER BY distance ASC
  LIMIT 1;

  IF nearest_location_id IS NULL THEN
    RETURN QUERY SELECT false, 'This gym has no active location set yet.', NULL::double precision;
    RETURN;
  END IF;

  is_checkin_valid := nearest_distance <= 25;

  INSERT INTO public.gym_checkins (
    user_id, gym_id, location_id, user_latitude, user_longitude, distance_meters, is_valid
  ) VALUES (
    auth.uid(), p_gym_id, nearest_location_id, p_user_latitude, p_user_longitude, nearest_distance,
    is_checkin_valid
  );

  IF is_checkin_valid THEN
    RETURN QUERY SELECT true, 'Checked in successfully!', nearest_distance;
  ELSE
    RETURN QUERY SELECT false, 'You need to be at the gym to check in.', nearest_distance;
  END IF;
END;$function$
