-- Esquema completo de Social Flamingo — regenerado desde la base de datos real (2026-07-03).
-- Ejecutar entero en el SQL Editor de Supabase en un proyecto nuevo.

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
  created_at timestamptz default now(),
  niche text,
  tone text,
  ai_instructions text,
  main_platform text,
  channel_name text,
  credits_refreshed_at timestamptz default now()
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

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text,
  platform text,
  niche text,
  created_at timestamptz default now()
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  channel_id uuid references channels(id),
  project_id uuid references projects(id) on delete set null,
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
  project_id uuid references projects(id) on delete set null,
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
  content jsonb, -- documentos del editor (formato Tiptap)
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

create index usage_logs_user_created_idx on usage_logs (user_id, created_at desc);

create table youtube_connections (
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
  updated_at timestamptz not null default now(),
  reporting_job_id text, -- YouTube Reporting API job (channel_reach_basic_a1), creado por el cron youtube-reach-sync
  reach_synced_until timestamptz -- último sync de CTR/impresiones; esos datos llegan con ~48h de retraso
);

-- CTR e impresiones de miniatura: solo disponibles vía YouTube Reporting API (bulk,
-- ~48h de retraso). Nunca se piden a la API interactiva de Analytics (no existen ahí).
create table youtube_reach_stats (
  user_id uuid not null references profiles(id) on delete cascade,
  video_id text not null,
  date date not null,
  impressions bigint not null default 0,
  ctr numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (user_id, video_id, date)
);

create index youtube_reach_stats_user_date_idx on youtube_reach_stats (user_id, date);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  remind_before_minutes integer,
  reminder_sent boolean not null default false,
  script_id uuid references scripts(id),
  start_time timestamptz,
  end_time timestamptz,
  color text default '#1a73e8',
  remind_times jsonb default '[]'::jsonb,
  sent_reminder_offsets jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  priority text default 'media',
  urgency text default 'media',
  importance text default 'normal',
  due_date date,
  category text,
  completed_at timestamptz,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Nuevo proyecto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Nueva conversación',
  messages jsonb not null default '[]'::jsonb,
  project_id uuid references chat_projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  model_used text not null,
  image_url text not null,
  storage_path text not null,
  parent_image_id uuid references generated_images(id) on delete set null,
  aspect_ratio text default '1:1',
  created_at timestamptz not null default now()
);

-- Caché de búsquedas de ideas en YouTube (compartida entre usuarios)
create table ideas_cache (
  query text primary key,
  results jsonb not null,
  cached_at timestamptz not null default now()
);

-- Idempotencia de webhooks de Stripe (solo la usa el service role)
create table stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table profiles enable row level security;
alter table channels enable row level security;
alter table projects enable row level security;
alter table ideas enable row level security;
alter table scripts enable row level security;
alter table watchlist_channels enable row level security;
alter table usage_logs enable row level security;
alter table youtube_connections enable row level security;
alter table calendar_events enable row level security;
alter table todos enable row level security;
alter table chat_projects enable row level security;
alter table chat_sessions enable row level security;
alter table generated_images enable row level security;
alter table ideas_cache enable row level security;
alter table stripe_events enable row level security; -- sin policies: solo service role

-- Nota de rendimiento: usar (select auth.uid()) en vez de auth.uid() a secas evita que
-- Postgres reevalúe la función en cada fila (ver "Auth RLS Initialization Plan" en los
-- advisors de Supabase).
create policy "own profile" on profiles for all using ((select auth.uid()) = id);
create policy "own channels" on channels for all using ((select auth.uid()) = user_id);
create policy "own projects" on projects for all using ((select auth.uid()) = user_id);
create policy "own ideas" on ideas for all using ((select auth.uid()) = user_id);
create policy "own scripts" on scripts for all using ((select auth.uid()) = user_id);
-- OJO: no crear una policy pública sobre scripts. La página /share/[id] accede
-- por share_token con el admin client (server-only).
create policy "own watchlist" on watchlist_channels for all using ((select auth.uid()) = user_id);
create policy "own logs" on usage_logs for all using ((select auth.uid()) = user_id);
create policy "Users manage own youtube connections" on youtube_connections for all using ((select auth.uid()) = user_id);
alter table youtube_reach_stats enable row level security;
-- Solo lectura para el dueño; el cron (service role) es el único que escribe.
create policy "own reach stats" on youtube_reach_stats for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can manage their own calendar events" on calendar_events
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage their own todos" on todos
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own projects" on chat_projects for all using ((select auth.uid()) = user_id);
create policy "Users can manage their own chat sessions" on chat_sessions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users own their generated images" on generated_images for all using ((select auth.uid()) = user_id);
-- Cache compartida entre usuarios: solo se lee desde el rol authenticated.
-- Los INSERT/UPDATE los hace el admin client (service role) desde el servidor —
-- si se deja escritura abierta a authenticated cualquier usuario puede envenenar
-- el caché de otras búsquedas.
create policy "authenticated read ideas_cache" on ideas_cache for select to authenticated using (true);

-- Índices para las foreign keys que no los tenían (ver advisor de performance).
create index if not exists calendar_events_script_id_idx on calendar_events (script_id);
create index if not exists channels_user_id_idx on channels (user_id);
create index if not exists chat_projects_user_id_idx on chat_projects (user_id);
create index if not exists chat_sessions_project_id_idx on chat_sessions (project_id);
create index if not exists generated_images_parent_image_id_idx on generated_images (parent_image_id);
create index if not exists generated_images_user_id_idx on generated_images (user_id);
create index if not exists ideas_channel_id_idx on ideas (channel_id);
create index if not exists ideas_project_id_idx on ideas (project_id);
create index if not exists ideas_user_id_idx on ideas (user_id);
create index if not exists projects_user_id_idx on projects (user_id);
create index if not exists scripts_channel_id_idx on scripts (channel_id);
create index if not exists scripts_idea_id_idx on scripts (idea_id);
create index if not exists scripts_project_id_idx on scripts (project_id);
create index if not exists scripts_user_id_idx on scripts (user_id);
create index if not exists todos_parent_id_idx on todos (parent_id);
create index if not exists watchlist_channels_user_id_idx on watchlist_channels (user_id);

-- ============================================================
-- Funciones y triggers
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
revoke execute on function handle_new_user() from anon, authenticated, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Los emails de Stripe/recordatorios se envían a profiles.email: si el usuario
-- cambia su email en auth, hay que propagarlo o seguirían llegando al antiguo.
create or replace function handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function handle_user_email_updated() from anon, authenticated, public;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure handle_user_email_updated();

-- Descuento atómico de créditos. Devuelve el saldo restante, -1 si es ilimitado,
-- o null si el perfil no existe o no hay saldo suficiente.
create or replace function deduct_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  select credits_remaining into v_remaining
  from public.profiles where id = p_user_id for update;

  if not found then
    return null;
  end if;

  if v_remaining = -1 then
    return -1;
  end if;

  if v_remaining < p_amount then
    return null;
  end if;

  update public.profiles
  set credits_remaining = credits_remaining - p_amount
  where id = p_user_id
  returning credits_remaining into v_remaining;

  return v_remaining;
end;
$$;
revoke execute on function deduct_credits(uuid, integer) from anon, authenticated, public;
grant execute on function deduct_credits(uuid, integer) to service_role;

create or replace function add_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update public.profiles
  set credits_remaining = case when credits_remaining = -1 then -1 else credits_remaining + p_amount end
  where id = p_user_id
  returning credits_remaining into v_remaining;
  return v_remaining;
end;
$$;
revoke execute on function add_credits(uuid, integer) from anon, authenticated, public;
grant execute on function add_credits(uuid, integer) to service_role;

-- ============================================================
-- Storage buckets — ejecutar por separado en el SQL Editor
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', false);
-- CREATE POLICY "Users upload own generated images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users read own generated images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users delete own generated images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- NOTA: no crear una policy de SELECT pública sobre este bucket — al ser público,
-- los objetos ya se sirven por URL sin necesidad de policy, y una policy SELECT
-- con USING(true) permite además *listar* todos los ficheros (enumerar user_ids).
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', false);
-- CREATE POLICY "Users upload own chat images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users read own chat images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
