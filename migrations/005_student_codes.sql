alter table public.profiles add column student_code text;

create function public.assign_profile_student_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.student_code is null or btrim(new.student_code) = '' then
    loop
      candidate := 'SB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      exit when not exists (
        select 1 from public.profiles where student_code = candidate
      );
    end loop;
    new.student_code := candidate;
  end if;
  return new;
end;
$$;

create trigger profiles_assign_student_code
before insert or update of student_code on public.profiles
for each row execute function public.assign_profile_student_code();

update public.profiles set student_code = null where student_code is null;

alter table public.profiles
  alter column student_code set not null,
  add constraint profiles_student_code_format
    check (student_code ~ '^SB-[A-F0-9]{12}$');

create unique index profiles_student_code_unique_idx
  on public.profiles(student_code);
