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
