create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  email_verified boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refresh_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash char(64) not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index refresh_sessions_user_idx on public.refresh_sessions(user_id);
create index refresh_sessions_expiry_idx on public.refresh_sessions(expires_at);

create table public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_verification_expiry_idx
  on public.email_verification_tokens(expires_at) where used_at is null;

create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_reset_expiry_idx
  on public.password_reset_tokens(expires_at) where used_at is null;

create table public.auth_rate_limits (
  id bigint generated always as identity primary key,
  action text not null,
  subject_hash char(64) not null,
  created_at timestamptz not null default now()
);
create index auth_rate_limits_action_subject_created_idx
  on public.auth_rate_limits(action, subject_hash, created_at desc);
create index auth_rate_limits_created_idx on public.auth_rate_limits(created_at);

create table public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  university_name text not null default '' check (char_length(university_name) <= 120),
  major text not null default '' check (char_length(major) <= 120),
  year_of_study smallint not null default 1 check (year_of_study between 1 and 12),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  is_onboarded boolean not null default false,
  show_in_discovery boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table public.student_subjects (
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);
create table public.student_availability (
  student_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  primary key (student_id, weekday),
  check (start_time < end_time)
);
create table public.study_preferences (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  learning_goals text[] not null default '{}',
  study_format text not null default 'hybrid'
    check (study_format in ('online', 'offline', 'hybrid')),
  group_size smallint not null default 4 check (group_size between 2 and 12),
  language text not null default 'English',
  preferred_hours text not null default 'afternoon'
    check (preferred_hours in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_discovery_idx
  on public.profiles(university_name, major)
  where is_onboarded and show_in_discovery;
create index student_subjects_subject_idx on public.student_subjects(subject_id);
create index student_availability_weekday_idx
  on public.student_availability(weekday);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index connections_pair_idx
  on public.connections (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );
create index connections_addressee_status_idx
  on public.connections(addressee_id, status);
create index connections_requester_status_idx
  on public.connections(requester_id, status);

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  subject text not null check (char_length(subject) between 1 and 80),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  max_members smallint not null default 8 check (max_members between 2 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_groups_discovery_idx
  on public.study_groups(subject, created_at desc) where visibility = 'public';
create index study_groups_owner_idx on public.study_groups(owner_id);

create table public.group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
create index group_members_student_idx on public.group_members(student_id);

create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, student_id)
);
create index group_join_requests_group_status_idx
  on public.group_join_requests(group_id, status, created_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  connection_id uuid unique references public.connections(id) on delete cascade,
  group_id uuid unique references public.study_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (kind = 'direct' and connection_id is not null and group_id is null)
    or (kind = 'group' and group_id is not null and connection_id is null)
  )
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, student_id)
);
create index conversation_members_student_idx
  on public.conversation_members(student_id, conversation_id);

create table public.websocket_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index websocket_tickets_expiry_idx
  on public.websocket_tickets(expires_at) where used_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc, id desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx
  on public.notifications(user_id, created_at desc) where read_at is null;
create index notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create unique index notifications_session_upcoming_unique
  on public.notifications(user_id, kind, entity_id)
  where kind = 'session_upcoming' and entity_id is not null;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 80),
  topic text not null check (char_length(topic) between 1 and 160),
  starts_at timestamptz not null,
  duration_minutes smallint not null default 60
    check (duration_minutes between 15 and 480),
  study_format text not null check (study_format in ('online', 'offline', 'hybrid')),
  meeting_details text not null default '' check (char_length(meeting_details) <= 1000),
  max_participants smallint not null default 6 check (max_participants between 2 and 50),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_sessions_owner_starts_idx on public.study_sessions(owner_id, starts_at);

create table public.session_participants (
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
create index session_participants_student_idx
  on public.session_participants(student_id, status, session_id);

create function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users','profiles','study_preferences','connections','study_groups',
    'group_join_requests','study_sessions'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create function public.notify_message_recipients()
returns trigger language plpgsql set search_path = public
as $$
declare
  sender_name text;
begin
  select full_name into sender_name from profiles where id = new.author_id;
  insert into notifications(user_id,kind,title,body,entity_type,entity_id)
  select cm.student_id,'new_message','New message',
         coalesce(sender_name,'A student') || ' sent a message.',
         'conversation',new.conversation_id
  from conversation_members cm
  where cm.conversation_id=new.conversation_id and cm.student_id<>new.author_id;
  perform pg_notify('study_buddy_messages', new.conversation_id::text);
  return new;
end;
$$;
create trigger messages_notify_recipients after insert on public.messages
for each row execute function public.notify_message_recipients();

create function public.notify_session_cancelled()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' then
    insert into notifications(user_id,kind,title,body,entity_type,entity_id)
    select sp.student_id,'session_cancelled','Study session cancelled',
           new.subject || ': ' || new.topic || ' was cancelled by the organizer.',
           'study_session',new.id
    from session_participants sp
    where sp.session_id=new.id and sp.student_id<>new.owner_id;
  end if;
  return new;
end;
$$;
create trigger session_cancelled_notify after update of status on study_sessions
for each row execute function public.notify_session_cancelled();

create function public.guard_study_group_capacity()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.max_members < (
    select count(*) from group_members where group_id=old.id
  ) then
    raise exception 'Maximum members cannot be lower than the current membership'
      using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger study_group_capacity_guard before update of max_members on study_groups
for each row execute function public.guard_study_group_capacity();

create function public.enforce_write_rate_limit()
returns trigger language plpgsql set search_path = public
as $$
declare
  actor_id uuid;
  operation_limit integer;
  interval_start timestamptz;
  operation_count bigint;
begin
  if tg_table_name='messages' then
    actor_id:=new.author_id; operation_limit:=30; interval_start:=now()-interval '1 minute';
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':messages',0));
    select count(*) into operation_count from messages
      where author_id=actor_id and created_at>=interval_start;
  elsif tg_table_name='connections' then
    if tg_op='UPDATE' and (new.status<>'pending' or old.status='pending') then return new; end if;
    actor_id:=new.requester_id; operation_limit:=10; interval_start:=now()-interval '1 hour';
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':connections',0));
    select count(*) into operation_count from connections
      where requester_id=actor_id and created_at>=interval_start;
  elsif tg_table_name='study_groups' then
    actor_id:=new.owner_id; operation_limit:=5; interval_start:=now()-interval '1 day';
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':groups',0));
    select count(*) into operation_count from study_groups
      where owner_id=actor_id and created_at>=interval_start;
  elsif tg_table_name='group_join_requests' then
    if tg_op='UPDATE' then return new; end if;
    actor_id:=new.student_id; operation_limit:=15; interval_start:=now()-interval '1 hour';
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':join_requests',0));
    select count(*) into operation_count from group_join_requests
      where student_id=actor_id and created_at>=interval_start;
  elsif tg_table_name='study_sessions' then
    actor_id:=new.owner_id; operation_limit:=10; interval_start:=now()-interval '1 day';
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text || ':sessions',0));
    select count(*) into operation_count from study_sessions
      where owner_id=actor_id and created_at>=interval_start;
  end if;
  if operation_count>=operation_limit then
    raise exception 'Rate limit exceeded. Try again later.' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on messages
for each row execute function public.enforce_write_rate_limit();
create trigger connections_rate_limit before insert or update of status on connections
for each row execute function public.enforce_write_rate_limit();
create trigger groups_rate_limit before insert on study_groups
for each row execute function public.enforce_write_rate_limit();
create trigger group_join_requests_rate_limit before insert on group_join_requests
for each row execute function public.enforce_write_rate_limit();
create trigger sessions_rate_limit before insert on study_sessions
for each row execute function public.enforce_write_rate_limit();
