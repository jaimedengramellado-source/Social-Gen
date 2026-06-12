create table if not exists youtube_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  channel_id text not null,
  channel_name text,
  channel_thumbnail text,
  subscriber_count bigint default 0,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table youtube_connections enable row level security;
create policy "Users manage own youtube connections"
  on youtube_connections for all using (auth.uid() = user_id);
