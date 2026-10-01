CREATE OR REPLACE FUNCTION public.get_location_stats(p_location_id bigint)
 RETURNS TABLE(avg_rating numeric, total_reviews bigint, checkins_today bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_avg_rating numeric;
  v_total_reviews bigint;
  v_checkins_today bigint;
BEGIN
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_avg_rating, v_total_reviews
  FROM gym_reviews
  WHERE location_id = p_location_id
    AND status = 'published';

  SELECT COUNT(*)
  INTO v_checkins_today
  FROM gym_checkins
  WHERE location_id = p_location_id
    AND checked_in_at::date = CURRENT_DATE
    AND is_valid = true;

  RETURN QUERY SELECT v_avg_rating, v_total_reviews, v_checkins_today;
END;
$function$;
