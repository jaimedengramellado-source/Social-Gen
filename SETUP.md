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
- **De momento solo Shorts**: el compositor bloquea YouTube si el vídeo no cualifica (vertical/cuadrado y ≤3 min, comprobado con la metadata del archivo). El vídeo largo necesita miniaturas y más ajustes que aún no existen.
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
3. Pasar **App Review** con estos permisos (requiere vídeo demo de cada uno): `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights` (visitas, para reglas condicionales), `pages_show_list`, `pages_read_engagement`, `business_management`. En modo Development funciona sin review para usuarios con rol en la app.
4. La cuenta de Instagram del usuario debe ser **business o creator y estar vinculada a una página de Facebook** — avisarlo en el onboarding de la conexión.

Funcionamiento: publicación de Reels por contenedores (`/{ig-user-id}/media` con la URL firmada del vídeo → poll de `status_code` → `media_publish`). No hay programación nativa: publica el cron `publish-scheduled` (cada 5 min). Límite de la API: 100 posts por cuenta/24h (de sobra).

## 12. Publicar en TikTok (/publicar)

Flag: **`ENABLE_TIKTOK_PUBLISHING=true`** + env vars **`TIKTOK_CLIENT_KEY`** y **`TIKTOK_CLIENT_SECRET`**.

Pasos manuales en [developers.tiktok.com](https://developers.tiktok.com):
1. Crear app y añadir **Login Kit** + **Content Posting API**.
2. Scopes: `user.info.basic`, `video.publish`, `video.upload`, `video.list` (visitas, para reglas condicionales).
3. Redirect URI: `https://socialflamingo.app/api/auth/tiktok/callback`.
4. **Solicitar el audit de Content Posting API**: hasta que TikTok lo apruebe, todos los posts van forzados a visibilidad "Solo yo" (SELF_ONLY) — la UI ya lo avisa leyendo `creator_info`.

Funcionamiento: subida por `FILE_UPLOAD` en chunks (init → PUT por rangos desde el bucket → poll de `status/fetch`). OJO: no usar `PULL_FROM_URL` para vídeos — está roto del lado de TikTok. El access token caduca en 24h: el cron refresca siempre antes de publicar.

**Fotos**: la Content Posting API solo las admite por `PULL_FROM_URL`, y TikTok exige que el **prefijo de la URL esté verificado** en el developer portal (URL properties). Por eso las fotos se sirven desde nuestro dominio vía `/api/publicaciones/media` (proxy firmado con HMAC) y no con la URL de supabase.co. Paso manual: verificar el prefijo `https://socialflamingo.app/api/publicaciones/media` (o el dominio entero) en la app de TikTok antes de publicar fotos.

## 13. Cola de publicación y bucket

- Los vídeos y fotos de todas las redes salvo YouTube esperan en el bucket privado **`publish-videos`** (creado por migración; SQL de referencia en schema.sql). Una publicación multi-red comparte un único objeto del bucket (mismo `group_id`); el cron lo borra cuando ya ninguna red del grupo lo necesita.
- **Límite de tamaño**: la UI corta en 400 MB (vídeo) y 5 MB (foto, tras recodificar a JPEG en el navegador), pero el límite real lo pone el proyecto de Supabase (Settings → Storage → Upload file size limit). **OJO: el plan Free lo capa a 50 MB y la API rechaza subirlo** (verificado 2026-07-14) — hace falta plan Pro y entonces fijarlo en 400 MB (Dashboard o `PATCH /v1/projects/{ref}/config/storage {"fileSizeLimit": 419430400}` con el token de la Management API).
- **Fotos**: `scheduled_posts.media_type` distingue `video`/`image`. Instagram publica la foto al feed (contenedor sin `media_type`, exige JPEG — el compositor recodifica), Facebook usa `POST /{page-id}/photos`, X `tweet_image` (máx 5 MB), LinkedIn la Images API (un solo PUT), Threads contenedor `IMAGE`, TikTok `PULL_FROM_URL` vía proxy (ver §12). YouTube no admite fotos y las reglas condicionales son solo para vídeo. Env var opcional `MEDIA_PROXY_SECRET` para firmar el proxy de medios (si falta usa `CRON_SECRET`).
- Cron `/api/cron/publish-scheduled` cada 5 min (vercel.json): publica Instagram/TikTok/X/LinkedIn/Threads pendientes, con 3 reintentos y continuación de estado entre ejecuciones (si la red sigue procesando, el siguiente run lo retoma por `platform_post_id`).
- Cron `/api/cron/automations` cada hora: alertas de hitos de visitas (flag `ENABLE_AUTOMATIONS=true`, sin pasos externos).

## 14. Publicar en X (/publicar)

Flag: **`ENABLE_X_PUBLISHING=true`** + env vars **`X_CLIENT_ID`** y **`X_CLIENT_SECRET`** (el secret solo si la app es confidential client; si es public client basta el ID).

Pasos manuales en [developer.x.com](https://developer.x.com):
1. Crear un proyecto + app en el portal de desarrolladores. El plan **Free** permite ~500 posts/mes a nivel de app (Basic: 3.000/mes por usuario) — elegir plan según volumen.
2. En **User authentication settings**: activar OAuth 2.0, tipo *Web App*, permisos *Read and write*.
3. Redirect URI: `https://socialflamingo.app/api/auth/x/callback` (y `http://localhost:3000/api/auth/x/callback` para dev).
4. Copiar el **OAuth 2.0 Client ID y Client Secret** (no confundir con las API keys de OAuth 1.0a).

Funcionamiento: OAuth 2.0 con PKCE y scopes `tweet.read tweet.write users.read media.write offline.access`. El access token dura 2h y el refresh token **rota en cada uso** (el cron guarda siempre el par nuevo). Vídeo por chunks de 4 MB al endpoint v2 de media (`initialize → append → finalize → status`), y el tweet se crea al terminar el procesado. Límite de vídeo estándar: 512 MB / 2:20 min (nuestro tope de 400 MB queda dentro). Fotos por el mismo endpoint con `media_category: tweet_image` (máx 5 MB — el compositor ya comprime a eso).

## 15. Publicar en LinkedIn (/publicar)

Flag: **`ENABLE_LINKEDIN_PUBLISHING=true`** + env vars **`LINKEDIN_CLIENT_ID`** y **`LINKEDIN_CLIENT_SECRET`**.

Pasos manuales en [linkedin.com/developers](https://www.linkedin.com/developers):
1. Crear una app (requiere asociarla a una **página de empresa** de LinkedIn) y verificarla desde la página.
2. Añadir los productos **"Sign In with LinkedIn using OpenID Connect"** y **"Share on LinkedIn"** (aprobación automática).
3. Redirect URI: `https://socialflamingo.app/api/auth/linkedin/callback`.
4. Scopes usados: `openid profile email w_member_social` (posts en el perfil personal del usuario).

Funcionamiento: vídeo por la Videos API (`initializeUpload` → PUT por partes con ETags → `finalizeUpload` → esperar `AVAILABLE`) y post por `rest/posts` (header `LinkedIn-Version: 202601`). **El token dura 60 días y las apps estándar no reciben refresh token** (solo partners del Marketing Developer Platform): al caducar, el usuario debe reconectar — el cron marca el post como fallido con ese aviso. Los caracteres reservados del "little text" de LinkedIn se escapan automáticamente.

## 16. Publicar en Threads (/publicar)

Flag: **`ENABLE_THREADS_PUBLISHING=true`** + env vars **`THREADS_APP_ID`** y **`THREADS_APP_SECRET`**.

Pasos manuales en [developers.facebook.com](https://developers.facebook.com):
1. Crear una app (o reutilizar la de Instagram) y añadir el caso de uso **"Access the Threads API"**. El App ID/secret de Threads son **distintos** de los de la app principal de Meta: se ven en Threads API → Settings.
2. Redirect URI: `https://socialflamingo.app/api/auth/threads/callback` (en "Redirect Callback URLs" del caso de uso de Threads).
3. Permisos `threads_basic`, `threads_content_publish` y `threads_manage_insights` (visitas, para reglas condicionales): en modo Development funcionan para usuarios con rol en la app; para producción, App Review con vídeo demo.

Funcionamiento: mismo modelo de contenedores que Instagram (`/{threads-user-id}/threads` con la URL firmada del vídeo → poll de `status` → `threads_publish`). Token largo de ~60 días que se renueva solo (`th_refresh_token`) cuando quedan menos de 7. Límite: 500 caracteres por post, 250 posts/24h.

## 17. Publicar en Facebook (/publicar)

Flag: **`ENABLE_FACEBOOK_PUBLISHING=true`** + las mismas env vars de Instagram (**`META_APP_ID`** y **`META_APP_SECRET`** — es la misma app de Meta).

Pasos manuales en [developers.facebook.com](https://developers.facebook.com):
1. En la app Business ya creada para Instagram, registrar el redirect URI adicional: `https://socialflamingo.app/api/auth/facebook/callback`.
2. Permisos en App Review: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `read_insights` (visitas, para reglas condicionales), `business_management` (varios ya se piden para Instagram — los nuevos son `pages_manage_posts` y `read_insights`). En modo Development funciona sin review para usuarios con rol en la app.
3. El usuario necesita administrar una **página de Facebook** (los perfiles personales no tienen API de publicación). Se publica en la primera página; el resto queda en `metadata.candidates`.

Funcionamiento: el más simple de todos — una sola llamada `POST /{page-id}/videos` con `file_url` (la URL firmada del bucket; Facebook descarga el vídeo él mismo) + `description`. Se guarda el **token de página**, que no caduca (sin refresh; si Meta lo invalida, reconectar). El token de usuario se conserva en `metadata.userToken` solo para revocar al desconectar. Permalink: `facebook.com/reel/{video-id}`.

## 18. Reglas condicionales de publicación cruzada

Sin flag ni env vars propios: se crean desde el compositor de /publicar ("si este vídeo supera N visitas en la red origen → publicarlo también en la red destino"), así que quedan protegidas por los flags de cada red.

- Multi origen/destino: "si en A **o** B supera N → publicar en C **y** D" se materializa como una fila por par con `rule_group_id` común; al dispararse hacia un destino, las hermanas hacia ese destino se dan por superadas (sin duplicados). El umbral admite presets o valor personalizado.
- Las evalúa el cron `/api/cron/automations` (cada hora, **no** depende de `ENABLE_AUTOMATIONS` — ese flag solo cubre los emails de hitos).
- El vídeo queda retenido en el bucket `publish-videos` hasta 30 días (ventana de la regla); al dispararse, caducar o cancelarse se libera si nada más lo usa.
- Redes origen (donde se miden visitas): YouTube, Instagram, Facebook, TikTok, X y Threads. LinkedIn no expone visitas de posts personales. Redes destino: todas menos YouTube (que no publica por cron).
- Leer visitas requiere los scopes de insights indicados en §11, §12, §16 y §17 (`instagram_manage_insights`, `video.list`, `threads_manage_insights`, `read_insights`) — ya añadidos al código de OAuth; inclúyelos en los App Review. Las conexiones hechas ANTES de este cambio no los tienen: reconectar la cuenta.
- Al dispararse una regla el usuario recibe un email y la publicación destino sale en ≤5 min (cron publish-scheduled).
