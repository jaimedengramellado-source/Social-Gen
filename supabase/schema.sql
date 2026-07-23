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
  platforms text[], -- todas las plataformas elegidas en onboarding; main_platform guarda la principal
  channel_name text,
  credits_refreshed_at timestamptz default now(),
  weekly_digest boolean not null default true, -- opt-out del resumen semanal por email
  posting_frequency text, -- ritmo de publicación declarado en onboarding/ajustes
  recording_style text, -- cómo graba (a cámara, voz en off, pantalla...); afina el guion generado
  reference_creators text, -- creadores que admira/quiere parecerse, para tono y ángulos de contenido
  main_goal text -- objetivo del canal; espejo del de channels pero este SÍ llega al contexto de la IA
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
  reach_synced_until timestamptz, -- último sync de CTR/impresiones; esos datos llegan con ~48h de retraso
  scopes text -- scopes OAuth concedidos; si no incluye youtube.upload hay que reconectar para subir vídeos
);

-- Cola de publicaciones en redes.
-- YouTube: programación nativa (publishAt), el vídeo sube directo navegador→YouTube.
-- Resto de redes: sin publishAt nativo — el vídeo espera en el bucket publish-videos
-- y el cron /api/cron/publish-scheduled lo publica a su hora.
create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null default 'youtube', -- youtube | instagram | facebook | tiktok | x | linkedin | threads
  title text not null,
  description text,
  tags text[] not null default '{}',
  privacy text not null default 'public', -- public | unlisted | private (solo publicación inmediata)
  scheduled_at timestamptz, -- null = publicar ya
  status text not null default 'uploading', -- uploading | scheduled | publishing | published | failed
  youtube_video_id text,
  platform_post_id text, -- id intermedio por red (container IG/Threads, publish_id TikTok, media_id X, urn de vídeo LinkedIn); permite continuar en el siguiente cron
  storage_path text, -- archivo en bucket publish-videos (todas las redes salvo YouTube); compartido dentro de un group_id
  media_type text not null default 'video' check (media_type in ('video', 'image')), -- las fotos no aplican a YouTube ni a reglas de publicación cruzada
  group_id uuid, -- publicación cruzada: las filas del mismo vídeo multi-red comparten group_id
  attempts integer not null default 0,
  settings jsonb not null default '{}'::jsonb, -- privacy_level TikTok, etc.
  error text,
  script_id uuid references scripts(id) on delete set null,
  calendar_event_id uuid references calendar_events(id) on delete set null,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conexiones a redes sociales distintas de YouTube
create table social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null, -- 'instagram' | 'facebook' | 'tiktok' | 'x' | 'linkedin' | 'threads'
  account_id text not null, -- IG business id / FB page id / TikTok open_id / X user id / LinkedIn sub / Threads user id
  account_name text,
  account_avatar text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  page_id text, -- IG: id de la página de Facebook vinculada
  scopes text,
  metadata jsonb not null default '{}'::jsonb, -- IG: candidates de cuentas; TikTok: creator_info
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

-- Automatizaciones post-publicación (fase 1: alertas de hitos de visitas en YouTube)
create table post_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null default 'youtube',
  trigger text not null default 'views_milestone',
  threshold integer not null,
  action text not null default 'email',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Reglas condicionales de publicación cruzada: "si este vídeo supera N visitas
-- en la red origen, publicarlo también en la red destino". El vídeo se retiene
-- en el bucket publish-videos mientras la regla esté en espera (status=waiting).
create table crosspost_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_post_id uuid not null references scheduled_posts(id) on delete cascade,
  source_platform text not null, -- youtube | instagram | facebook | tiktok | x | threads (LinkedIn no expone visitas)
  target_platform text not null, -- instagram | facebook | tiktok | x | linkedin | threads (YouTube no publica por cron)
  threshold integer not null,
  window_days integer not null default 30,
  rule_group_id uuid not null default gen_random_uuid(), -- reglas creadas juntas (multi origen/destino); al disparar hacia un destino, las hermanas hacia ese destino se dan por superadas
  text text not null, -- texto del post destino, resuelto al crear la regla
  settings jsonb not null default '{}'::jsonb, -- privacy_level si el destino es TikTok
  storage_path text not null,
  file_name text,
  file_size bigint,
  status text not null default 'waiting', -- waiting | fired | expired | failed
  error text,
  fired_post_id uuid references scheduled_posts(id) on delete set null,
  last_views bigint,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotencia: cada automatización dispara una sola vez por vídeo (escribe el cron/service role)
create table automation_events (
  automation_id uuid not null references post_automations(id) on delete cascade,
  video_id text not null,
  fired_at timestamptz not null default now(),
  primary key (automation_id, video_id)
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
  tag text, -- flujo de trabajo: grabar | editar | publicar | idea | reunion
  remind_times jsonb default '[]'::jsonb,
  sent_reminder_offsets jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Firmas/snippets reutilizables (CTAs, hashtags, cierres) — se insertan en el chat de /crear
create table snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  content text not null,
  sort_order integer not null default 0,
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

-- Jobs asíncronos de generación de vídeo (plantillas Remotion). El render tarda
-- demasiado para una request síncrona: la app encola (queued), un worker externo
-- con service role reclama (rendering) y sube el MP4 al bucket videos (done).
create table video_renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instructions text not null,
  template text not null,
  props jsonb not null default '{}'::jsonb,
  duration_seconds integer not null default 6,
  status text not null default 'queued' check (status in ('queued','rendering','done','error')),
  storage_path text,
  video_url text,
  error text,
  credits_spent integer not null default 0,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
alter table snippets enable row level security;
alter table scheduled_posts enable row level security;
alter table social_connections enable row level security;
alter table post_automations enable row level security;
alter table automation_events enable row level security;
alter table todos enable row level security;
alter table chat_projects enable row level security;
alter table chat_sessions enable row level security;
alter table generated_images enable row level security;
alter table video_renders enable row level security;
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
create policy "own snippets" on snippets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own scheduled posts" on scheduled_posts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own social connections" on social_connections
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own automations" on post_automations
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own automation events" on automation_events
  for select to authenticated
  using (automation_id in (select id from post_automations where user_id = (select auth.uid())));
create policy "Users manage own crosspost rules" on crosspost_rules
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can manage their own todos" on todos
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own projects" on chat_projects for all using ((select auth.uid()) = user_id);
create policy "Users can manage their own chat sessions" on chat_sessions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users own their generated images" on generated_images for all using ((select auth.uid()) = user_id);
-- Renders de vídeo: el usuario lee y crea; solo el worker (service role) actualiza estado/URL.
create policy "Users read their video renders" on video_renders
  for select using ((select auth.uid()) = user_id);
create policy "Users create their video renders" on video_renders
  for insert with check ((select auth.uid()) = user_id);
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
create index if not exists snippets_user_id_idx on snippets (user_id, sort_order);
create index if not exists scheduled_posts_user_created_idx on scheduled_posts (user_id, created_at desc);
create index if not exists scheduled_posts_script_id_idx on scheduled_posts (script_id);
create index if not exists scheduled_posts_calendar_event_id_idx on scheduled_posts (calendar_event_id);
create index if not exists scheduled_posts_due_idx on scheduled_posts (status, scheduled_at)
  where status in ('scheduled', 'publishing');
create index if not exists scheduled_posts_group_idx on scheduled_posts (group_id) where group_id is not null;
create index if not exists post_automations_user_idx on post_automations (user_id);
create index if not exists crosspost_rules_user_idx on crosspost_rules (user_id, created_at desc);
create index if not exists crosspost_rules_waiting_idx on crosspost_rules (status) where status = 'waiting';
create index if not exists crosspost_rules_storage_idx on crosspost_rules (storage_path) where status = 'waiting';
create index if not exists crosspost_rules_group_idx on crosspost_rules (rule_group_id);
create index if not exists todos_parent_id_idx on todos (parent_id);
create index if not exists watchlist_channels_user_id_idx on watchlist_channels (user_id);
create index if not exists video_renders_user_id_idx on video_renders (user_id, created_at desc);
create index if not exists video_renders_queue_idx on video_renders (status, created_at) where status in ('queued','rendering');

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
--
-- Vídeos en espera de publicarse en Instagram/TikTok (los borra el cron al publicar)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('publish-videos', 'publish-videos', false);
-- CREATE POLICY "Users upload own publish videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'publish-videos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- CREATE POLICY "Users read own publish videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'publish-videos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- CREATE POLICY "Users delete own publish videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'publish-videos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- Bucket de vídeos generados con Remotion ({user_id}/{render_id}.mp4).
-- Solo escribe el worker con service role; el usuario solo lee su carpeta.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
-- CREATE POLICY "Users read own videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
