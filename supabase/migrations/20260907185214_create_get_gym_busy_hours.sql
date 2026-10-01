create or replace function get_gym_busy_hours(target_gym_id bigint, target_timezone text default 'Asia/Kolkata')
returns table(hour_of_day int, checkin_count bigint)
language sql stable security definer as $$
  select
    extract(hour from checked_in_at at time zone target_timezone)::int as hour_of_day,
    count(*) as checkin_count
  from gym_checkins
  where gym_id = target_gym_id
    and is_valid = true
    and (checked_in_at at time zone target_timezone)::date = (now() at time zone target_timezone)::date
  group by hour_of_day
  order by hour_of_day;
$$;

grant execute on function get_gym_busy_hours(bigint, text) to authenticated;
