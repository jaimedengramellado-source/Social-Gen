create table profiles (
  id uuid references auth.users primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'free',
  credits_remaining integer default 10,
  credits_total integer default 10,
  stripe_customer_id text,
  stripe_subscription_id text,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  platform text,
  channel_name text,
  channel_url text,
  subscribers_range text,
  niche text,
  niche_description text,
  content_format text,
  main_goal text,
  differentiator text,
  audience_pain text,
  best_video_reason text,
  is_public boolean default false,
  created_at timestamptz default now()
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  channel_id uuid references channels(id),
  title text,
  description text,
  platform text,
  format text,
  niche text,
  viral_score integer,
  hook_type text,
  content_style text,
  is_saved boolean default false,
  created_at timestamptz default now()
);

create table scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  channel_id uuid references channels(id),
  idea_id uuid references ideas(id),
  title text,
  platform text,
  format text,
  niche text,
  duration text,
  tone text,
  hook text,
  intro text,
  main_content jsonb,
  retention_peaks jsonb,
  cta text,
  title_suggestions jsonb,
  thumbnail_concepts jsonb,
  viral_score integer,
  estimated_retention integer,
  status text default 'draft',
  share_token text unique default gen_random_uuid()::text,
  credits_used integer default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table watchlist_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  channel_name text,
  channel_url text,
  platform text,
  subscribers text,
  niche text,
  outlier_detected boolean default false,
  engagement_tag text,
  created_at timestamptz default now()
);

create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  action text,
  credits_spent integer,
  metadata jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table channels enable row level security;
alter table ideas enable row level security;
alter table scripts enable row level security;
alter table watchlist_channels enable row level security;
alter table usage_logs enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own channels" on channels for all using (auth.uid() = user_id);
create policy "own ideas" on ideas for all using (auth.uid() = user_id);
create policy "own scripts" on scripts for all using (auth.uid() = user_id);
create policy "public scripts" on scripts for select using (status = 'saved');
create policy "own watchlist" on watchlist_channels for all using (auth.uid() = user_id);
create policy "own logs" on usage_logs for all using (auth.uid() = user_id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
