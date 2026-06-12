-- Projects table: groups ideas + scripts from a single creation session
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  platform text,
  niche text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
create policy "Users manage own projects" on projects for all using (auth.uid() = user_id);

-- Link ideas and scripts to a project
alter table ideas add column if not exists project_id uuid references projects(id) on delete set null;
alter table scripts add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists ideas_project_id_idx on ideas(project_id);
create index if not exists scripts_project_id_idx on scripts(project_id);
