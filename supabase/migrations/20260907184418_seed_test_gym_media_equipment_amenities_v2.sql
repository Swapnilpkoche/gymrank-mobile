-- Hero image
INSERT INTO public.gym_media (gym_id, media_type, role, url, sort_order) VALUES
(2, 'photo', 'hero', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200', 0);

-- Gallery images/videos
INSERT INTO public.gym_media (gym_id, media_type, role, url, sort_order) VALUES
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600', 1),
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600', 2),
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600', 3),
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=600', 4),
(2, 'video', 'gallery', 'https://example.com/gym-tour.mp4', 5),
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600', 6),
(2, 'photo', 'gallery', 'https://images.unsplash.com/photo-1637666300656-cff3edaddda3?w=600', 7);

-- Logo
INSERT INTO public.gym_media (gym_id, media_type, role, url, sort_order) VALUES
(2, 'photo', 'logo', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200', 0);

-- Equipment
INSERT INTO public.gym_equipment (gym_id, name) VALUES
(2, 'Treadmills (6)'),
(2, 'Squat racks (3)'),
(2, 'Cable machines (4)'),
(2, 'Free weights up to 50kg'),
(2, 'Rowing machines (2)');

-- Amenities
INSERT INTO public.gym_amenities (gym_id, name) VALUES
(2, 'Sauna'),
(2, 'Ice bath'),
(2, 'Spa'),
(2, 'Locker rooms'),
(2, 'Parking');
