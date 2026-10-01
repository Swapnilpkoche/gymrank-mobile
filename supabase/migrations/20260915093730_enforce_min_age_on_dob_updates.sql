-- Extends the edit-limit trigger to also enforce the minimum age of 16 on
-- every UPDATE that sets a non-null date_of_birth - covers the existing-user
-- backfill prompt (first collection via UPDATE, not INSERT) and any later
-- edit, complementing handle_new_user's check at signup (INSERT). Checked
-- before the edit-limit logic so a rejected/invalid value never consumes one
-- of the 2 allowed edits.
create or replace function public.enforce_dob_edit_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.date_of_birth is not null
     and new.date_of_birth is distinct from old.date_of_birth
     and extract(year from age(current_date, new.date_of_birth)) < 16 then
    raise exception 'You must be at least 16 years old.';
  end if;

  if old.date_of_birth is not null and new.date_of_birth is distinct from old.date_of_birth then
    if old.dob_edit_count >= 2 then
      raise exception 'Date of birth is now permanently locked after 2 changes. To change it further, you would need to delete and recreate your account.';
    end if;
    new.dob_edit_count := old.dob_edit_count + 1;
  end if;

  return new;
end;
$function$;
