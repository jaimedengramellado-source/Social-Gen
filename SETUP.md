# SETUP — Social Flamingo

## 1. Configurar Supabase

### 1.1 Crear proyecto
1. Ir a [supabase.com](https://supabase.com) → Crear proyecto
2. Copiar **Project URL** y **anon key** de Settings → API

### 1.2 Ejecutar schema SQL
1. Ir a Supabase → SQL Editor
2. Abrir `supabase/schema.sql` de este proyecto
3. Ejecutar todo el SQL (crea tablas, políticas RLS y trigger de nuevo usuario)

### 1.3 Configurar Google OAuth (opcional)
1. Supabase → Authentication → Providers → Google → Enable
2. Crear credenciales OAuth en [console.cloud.google.com](https://console.cloud.google.com)
3. Añadir `https://[tu-proyecto].supabase.co/auth/v1/callback` como Redirect URI en Google Console
4. Pegar Client ID y Client Secret en Supabase
5. Añadir `http://localhost:3000/auth/callback` en Supabase → Authentication → URL Configuration → Redirect URLs

### 1.4 Copiar claves
Del dashboard de Supabase → Settings → API:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1N...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1N...  (Settings > API > service_role)
```

---

## 2. Obtener API Key de Anthropic

1. Ir a [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key
3. Copiar la clave:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 3. Configurar Stripe

### 3.1 Cuenta
Stripe ya está en **live mode**. No usar test keys.

### 3.2 Productos y precios (ya creados en live mode)

Los precios coinciden con los de la landing (`PRICING_PLANS` en `src/types/index.ts`).
Los precios antiguos (4,75/12,25/24,75 €/sem) quedaron archivados el 2026-07-03 — no reactivarlos.

| Env var | Price ID | Descripción |
|---|---|---|
| `STRIPE_STARTER_WEEKLY_PRICE_ID` | `price_1To4StLTq2Nj2Fq3LDO7IPQ4` | 2,49 €/semana |
| `STRIPE_STARTER_ANNUAL_PRICE_ID` | `price_1To4SuLTq2Nj2Fq3GL2zFu8o` | 124,99 €/año |
| `STRIPE_PRO_WEEKLY_PRICE_ID` | `price_1To4SvLTq2Nj2Fq37Lok8VSo` | 6,49 €/semana |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | `price_1To4SzLTq2Nj2Fq3l2kyiv8N` | 324,99 €/año |
| `STRIPE_AGENCY_WEEKLY_PRICE_ID` | `price_1To4T0LTq2Nj2Fq3PxYfnzPu` | 19,99 €/semana |
| `STRIPE_AGENCY_ANNUAL_PRICE_ID` | `price_1To4T0LTq2Nj2Fq3IazgtJdB` | 999,99 €/año |
| `STRIPE_PACK_50_PRICE_ID` | `price_1TnxbmLTq2Nj2Fq3gx0ShRs8` | 9 € one-time |
| `STRIPE_PACK_150_PRICE_ID` | `price_1TnxbmLTq2Nj2Fq3t37zeaQm` | 19 € one-time |
| `STRIPE_PACK_500_PRICE_ID` | `price_1TnxbnLTq2Nj2Fq3I2xeRpU3` | 49 € one-time |

### 3.3 Configurar Webhook (live)
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://tu-dominio.com/api/stripe/webhook`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `payment_intent.succeeded` (cobro instantáneo de créditos con tarjeta guardada, sin pasar por Checkout)
   - `customer.updated` (propaga el cambio de tarjeta hecho desde Ajustes → Facturación a las suscripciones activas)
   - `invoice.payment_failed` (email al usuario en el primer cobro fallido, con enlace a Ajustes → Facturación para actualizar la tarjeta)
4. Copiar Signing Secret → `STRIPE_WEBHOOK_SECRET`

Si el endpoint ya existía antes de añadir `payment_intent.succeeded`, edítalo en el Dashboard y añade el evento — si no, el cobro instantáneo desde el popup de créditos se realizará pero nunca se acreditarán los créditos.

Lo mismo con `customer.updated`: sin él, al cambiar la tarjeta desde la pestaña Facturación las suscripciones existentes (que fijan su propia tarjeta al crearse por Checkout) seguirían cobrando la tarjeta antigua.

### 3.3b Portal de facturación
En Stripe Dashboard → Settings → Billing → Customer portal, la opción **Payment methods → Allow customers to update their payment methods** debe estar activada (lo está por defecto). La pestaña Facturación de Ajustes usa el flujo `payment_method_update` del portal para cambiar la tarjeta.

### 3.4 Claves Stripe (live)
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_WEEKLY_PRICE_ID=price_1To4StLTq2Nj2Fq3LDO7IPQ4
STRIPE_STARTER_ANNUAL_PRICE_ID=price_1To4SuLTq2Nj2Fq3GL2zFu8o
STRIPE_PRO_WEEKLY_PRICE_ID=price_1To4SvLTq2Nj2Fq37Lok8VSo
STRIPE_PRO_ANNUAL_PRICE_ID=price_1To4SzLTq2Nj2Fq3l2kyiv8N
STRIPE_AGENCY_WEEKLY_PRICE_ID=price_1To4T0LTq2Nj2Fq3PxYfnzPu
STRIPE_AGENCY_ANNUAL_PRICE_ID=price_1To4T0LTq2Nj2Fq3IazgtJdB
STRIPE_PACK_50_PRICE_ID=price_1TnxbmLTq2Nj2Fq3gx0ShRs8
STRIPE_PACK_150_PRICE_ID=price_1TnxbmLTq2Nj2Fq3t37zeaQm
STRIPE_PACK_500_PRICE_ID=price_1TnxbnLTq2Nj2Fq3I2xeRpU3
```

---

## 4. Configurar .env.local

Copiar `.env.local.example` a `.env.local`:
```bash
cp .env.local.example .env.local
```

Rellenar todas las variables (la lista completa y actualizada está en `.env.local.example`).
Los price IDs usan billing **semanal** (`*_WEEKLY_*`), no mensual.

Variables adicionales a las de Supabase/Stripe/Anthropic:
```
GOOGLE_GEMINI_API_KEY=      # imágenes (paso 6)
GOOGLE_CLIENT_ID=           # OAuth YouTube en /estadisticas
GOOGLE_CLIENT_SECRET=
CRON_SECRET=                # OBLIGATORIO en Vercel: autentica los crons (fail-closed)
RESEND_API_KEY=             # emails de recordatorio
RESEND_FROM_EMAIL=          # remitente verificado en Resend
```

---

## 5. Ejecutar en local

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### Para probar webhooks de Stripe en local:
```bash
# En otra terminal:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Para probar pagos con Stripe:
- Tarjeta de prueba: `4242 4242 4242 4242`
- Fecha: cualquier fecha futura
- CVC: cualquier 3 dígitos

---

## 6. Google Gemini API (generación de imágenes)

### 6.1 Obtener API Key
1. Ir a [aistudio.google.com](https://aistudio.google.com) → Get API Key → Create API key
2. Copiar la clave y añadirla a `.env.local`:
```
GOOGLE_GEMINI_API_KEY=AIza...
```

### 6.2 Bucket generated-images
Ejecutar en SQL Editor de Supabase:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', false);

CREATE POLICY "Users upload own generated images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own generated images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own generated images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 6.3 Tabla generated_images
Ejecutar el bloque de `generated_images` del `supabase/schema.sql` en el SQL Editor (está al final del archivo).

---

## 7. Bucket de avatares de perfil

Ejecutar en SQL Editor de Supabase:

```sql
-- Crear bucket público (las URLs de avatar se usan en <img> sin autenticación)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Policy: el usuario autenticado puede subir/actualizar su propio avatar
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: cualquiera puede leer avatares (bucket público)
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

---

## 8. Bucket de imágenes del chat (chat-attachments)

Ejecutar en SQL Editor de Supabase:

```sql
-- Crear bucket privado
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false);

-- Policy: usuarios autenticados pueden subir a su propia carpeta
create policy "Users upload own chat images"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: usuarios autenticados pueden leer sus propias imágenes
create policy "Users read own chat images"
on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
```

## 9. YouTube Analytics (/estadisticas)

Usa `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (mismo proyecto de Google Cloud del paso 1.3) y `YOUTUBE_API_KEY` (API key, no OAuth).

En [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Library, habilitar las 3 APIs:
1. **YouTube Data API v3** — info de canal/vídeos.
2. **YouTube Analytics API** — vistas, tiempo de visualización, retención, etc. (tiempo real).
3. **YouTube Reporting API** — CTR e impresiones de miniatura. Estos datos **no existen** en la API de Analytics en tiempo real, solo vía reportes bulk que Google genera con ~48h de retraso (`reportTypeId: channel_reach_basic_a1`). Los sincroniza el cron `/api/cron/youtube-reach-sync` (diario, `vercel.json`) hacia la tabla `youtube_reach_stats`. No requiere pedir un scope OAuth nuevo — `yt-analytics.readonly` (ya solicitado en `/api/auth/youtube/connect`) cubre también la Reporting API.

Añadir `http://localhost:3000/api/auth/youtube/callback` (y el equivalente de producción) como Redirect URI en las credenciales OAuth de Google Console.

## 10. Publicar en YouTube (/publicar)

La subida usa el mismo proyecto OAuth del paso 9 más el scope **`youtube.upload`** (sensible). Pasos manuales en [console.cloud.google.com](https://console.cloud.google.com):

1. **OAuth consent screen → Data access (Scopes)**: añadir `https://www.googleapis.com/auth/youtube.upload`. Mientras la app esté en modo *Testing* funciona para los test users sin verificación; para producción hay que **re-enviar la verificación de Google** incluyendo el scope nuevo (justificación + vídeo demo).
2. **Cuota de YouTube Data API**: `videos.insert` cuesta **1.600 unidades** y la cuota por defecto es 10.000/día por proyecto → ~6 subidas diarias para toda la app. Para escalar, solicitar ampliación con el [YouTube API Services quota audit form](https://support.google.com/youtube/contact/yt_api_form).
3. Los usuarios que conectaron su canal antes de este cambio tienen tokens sin el scope de subida (columna `youtube_connections.scopes` en null): la página `/publicar` les pide reconectar automáticamente.

Notas de funcionamiento (sin pasos manuales):
- El vídeo sube **directo del navegador a YouTube** (sesión resumable creada por `/api/youtube/upload-session`); nunca pasa por Vercel ni por Supabase Storage.
- La programación es nativa de YouTube (`status.publishAt`): el vídeo se sube en privado y YouTube lo publica solo. No hay cron de publicación.
- Estado de las publicaciones en la tabla `scheduled_posts` (sync perezoso en `GET /api/publicaciones`).

### 10.1 Activación

La feature está detrás del flag **`ENABLE_YOUTUBE_PUBLISHING`** (env var de servidor, sin `NEXT_PUBLIC_`). Mientras no valga `true`:
- `/publicar` muestra "Próximamente".
- El OAuth de `/api/auth/youtube/connect` NO pide el scope `youtube.upload` (evita el aviso de "app no verificada" al conectar desde /estadisticas).
- `/api/youtube/upload-session` responde 503.

Cuando los pasos 1–2 de arriba estén hechos: añadir `ENABLE_YOUTUBE_PUBLISHING=true` en Vercel (y `.env.local` para dev) y redeploy.

## 11. Publicar en Instagram (/publicar)

Flag: **`ENABLE_INSTAGRAM_PUBLISHING=true`** + env vars **`META_APP_ID`** y **`META_APP_SECRET`**.

Pasos manuales en [developers.facebook.com](https://developers.facebook.com):
1. Crear una **app de tipo Business** y añadir el producto **Facebook Login for Business**.
2. Registrar el redirect URI: `https://socialflamingo.app/api/auth/instagram/callback` (y localhost para dev).
3. Pasar **App Review** con estos permisos (requiere vídeo demo de cada uno): `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`. En modo Development funciona sin review para usuarios con rol en la app.
4. La cuenta de Instagram del usuario debe ser **business o creator y estar vinculada a una página de Facebook** — avisarlo en el onboarding de la conexión.

Funcionamiento: publicación de Reels por contenedores (`/{ig-user-id}/media` con la URL firmada del vídeo → poll de `status_code` → `media_publish`). No hay programación nativa: publica el cron `publish-scheduled` (cada 5 min). Límite de la API: 100 posts por cuenta/24h (de sobra).

## 12. Publicar en TikTok (/publicar)

Flag: **`ENABLE_TIKTOK_PUBLISHING=true`** + env vars **`TIKTOK_CLIENT_KEY`** y **`TIKTOK_CLIENT_SECRET`**.

Pasos manuales en [developers.tiktok.com](https://developers.tiktok.com):
1. Crear app y añadir **Login Kit** + **Content Posting API**.
2. Scopes: `user.info.basic`, `video.publish`, `video.upload`.
3. Redirect URI: `https://socialflamingo.app/api/auth/tiktok/callback`.
4. **Solicitar el audit de Content Posting API**: hasta que TikTok lo apruebe, todos los posts van forzados a visibilidad "Solo yo" (SELF_ONLY) — la UI ya lo avisa leyendo `creator_info`.

Funcionamiento: subida por `FILE_UPLOAD` en chunks (init → PUT por rangos desde el bucket → poll de `status/fetch`). OJO: no usar `PULL_FROM_URL` para vídeos — está roto del lado de TikTok. El access token caduca en 24h: el cron refresca siempre antes de publicar.

## 13. Cola de publicación y bucket

- Los vídeos de IG/TikTok esperan en el bucket privado **`publish-videos`** (creado por migración; SQL de referencia en schema.sql). El cron los borra al publicar o fallar definitivamente.
- **Límite de tamaño**: la UI corta en 200 MB, pero el límite real lo pone el proyecto de Supabase (Settings → Storage → Upload file size limit, 50 MB por defecto) — subirlo a 200 MB.
- Cron `/api/cron/publish-scheduled` cada 5 min (vercel.json): publica IG/TikTok pendientes, con 3 reintentos y continuación de estado entre ejecuciones (si Meta/TikTok siguen procesando, el siguiente run lo retoma).
- Cron `/api/cron/automations` cada hora: alertas de hitos de visitas (flag `ENABLE_AUTOMATIONS=true`, sin pasos externos).
