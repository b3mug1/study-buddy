alter table public.connections
  add column if not exists intro_messages_sent smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connections_intro_messages_sent_check'
      and conrelid = 'public.connections'::regclass
  ) then
    alter table public.connections
      add constraint connections_intro_messages_sent_check
      check (intro_messages_sent between 0 and 3);
  end if;
end;
$$;
