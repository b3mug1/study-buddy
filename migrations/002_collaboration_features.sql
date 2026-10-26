alter table public.study_sessions
  drop constraint if exists study_sessions_status_check,
  add constraint study_sessions_status_check
    check (status in ('scheduled', 'cancelled', 'completed')),
  add column if not exists summary text not null default ''
    check (char_length(summary) <= 1200),
  add column if not exists next_steps text not null default ''
    check (char_length(next_steps) <= 1200);

create table public.group_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index group_tasks_group_due_idx on public.group_tasks(group_id, due_at nulls last);
create index group_tasks_assignee_status_idx on public.group_tasks(assigned_to, status);
create trigger group_tasks_updated_at before update on public.group_tasks
  for each row execute function public.set_updated_at();

create table public.group_materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  source_url text,
  file_name text,
  mime_type text,
  file_data bytea,
  created_at timestamptz not null default now(),
  constraint group_materials_single_source check (
    (source_url is not null and file_data is null and file_name is null and mime_type is null)
    or
    (source_url is null and file_data is not null and file_name is not null and mime_type is not null
      and octet_length(file_data) between 1 and 5242880)
  )
);
create index group_materials_group_created_idx
  on public.group_materials(group_id, created_at desc);

create table public.group_focus_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  started_by uuid not null references public.profiles(id) on delete cascade,
  focus_minutes smallint not null check (focus_minutes between 5 and 120),
  break_minutes smallint not null default 5 check (break_minutes between 1 and 30),
  status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_focus_sessions_active_idx on public.group_focus_sessions(group_id, started_at desc)
  where status = 'running';

create table public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 80),
  target_sessions smallint not null check (target_sessions between 1 and 100),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index study_goals_user_subject_unique on public.study_goals(user_id, lower(subject));
create index study_goals_user_idx on public.study_goals(user_id, target_date);
create trigger study_goals_updated_at before update on public.study_goals
  for each row execute function public.set_updated_at();

create table public.study_goal_topics (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.study_goals(id) on delete cascade,
  topic text not null check (char_length(topic) between 2 and 160),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);
create unique index study_goal_topics_unique on public.study_goal_topics(goal_id, lower(topic));
create index study_goal_topics_goal_created_idx on public.study_goal_topics(goal_id, created_at);

create table public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocked_users_blocked_idx on public.blocked_users(blocked_id, blocker_id);

create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('profile', 'message')),
  entity_id uuid not null,
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id),
  unique (reporter_id, entity_type, entity_id)
);
create index safety_reports_review_idx on public.safety_reports(status, created_at);
