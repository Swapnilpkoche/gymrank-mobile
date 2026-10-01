INSERT INTO public.gym_checkins (user_id, gym_id, location_id, checked_in_at, is_valid, user_latitude, user_longitude, distance_meters) VALUES
('531462f5-6c90-411b-9dbb-4b8245603371', 2, 1, date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '7 hours', true, 21.1458, 79.0882, 20),
('708a523b-5335-4925-8282-da56356f101b', 2, 1, date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '8 hours', true, 21.1458, 79.0882, 15),
('524c3edb-2dfb-4608-bca6-edf5138927ba', 2, 1, date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '18 hours', true, 21.1458, 79.0882, 25),
('3990c50c-a25d-4cb3-a8ea-03d3bd44f365', 2, 1, date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '18 hours 15 minutes', true, 21.1458, 79.0882, 10),
('531462f5-6c90-411b-9dbb-4b8245603371', 2, 1, date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' + interval '19 hours', true, 21.1458, 79.0882, 18);
