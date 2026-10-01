alter table public.profiles
  add constraint profiles_dob_min_age_check
  check (
    date_of_birth is null
    or extract(year from age(current_date, date_of_birth)) >= 16
  );
