# SETUP — Social Gen

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

### 3.1 Crear cuenta
1. Ir a [stripe.com](https://stripe.com) → activar modo Test

### 3.2 Crear productos y precios
En Stripe Dashboard → Products → Add product:

**Plan Starter** — $19/mes
- Crear producto "Social Gen Starter"
- Price: $19.00, recurring monthly
- Copiar Price ID: `STRIPE_STARTER_MONTHLY_PRICE_ID`

**Plan Starter Anual** — $15/mes (facturado $180/año)
- Price: $180.00, recurring yearly
- Copiar Price ID: `STRIPE_STARTER_ANNUAL_PRICE_ID`

**Plan Pro** — $49/mes
- Crear producto "Social Gen Pro"
- Price: $49.00, recurring monthly
- Copiar Price ID: `STRIPE_PRO_MONTHLY_PRICE_ID`

**Plan Pro Anual** — $39/mes (facturado $468/año)
- Price: $468.00, recurring yearly
- Copiar Price ID: `STRIPE_PRO_ANNUAL_PRICE_ID`

**Plan Agency** — $99/mes
- Crear producto "Social Gen Agency"
- Price: $99.00, recurring monthly
- Copiar Price ID: `STRIPE_AGENCY_MONTHLY_PRICE_ID`

**Plan Agency Anual** — $79/mes (facturado $948/año)
- Price: $948.00, recurring yearly
- Copiar Price ID: `STRIPE_AGENCY_ANNUAL_PRICE_ID`

**Pack 50 créditos** — $9 (one-time)
- Crear producto "Social Gen Pack 50"
- Price: $9.00, one-time
- Copiar Price ID: `STRIPE_PACK_50_PRICE_ID`

**Pack 150 créditos** — $19 (one-time)
- Crear producto "Social Gen Pack 150"
- Price: $19.00, one-time
- Copiar Price ID: `STRIPE_PACK_150_PRICE_ID`

**Pack 500 créditos** — $49 (one-time)
- Crear producto "Social Gen Pack 500"
- Price: $49.00, one-time
- Copiar Price ID: `STRIPE_PACK_500_PRICE_ID`

### 3.3 Configurar Webhook
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://tu-dominio.com/api/stripe/webhook`
   - En local: usar [Stripe CLI](https://stripe.com/docs/stripe-cli) → `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Copiar Signing Secret: `STRIPE_WEBHOOK_SECRET`

### 3.4 Copiar claves Stripe
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_AGENCY_MONTHLY_PRICE_ID=price_...
STRIPE_AGENCY_ANNUAL_PRICE_ID=price_...
STRIPE_PACK_50_PRICE_ID=price_...
STRIPE_PACK_150_PRICE_ID=price_...
STRIPE_PACK_500_PRICE_ID=price_...
```

---

## 4. Configurar .env.local

Copiar `.env.local.example` a `.env.local`:
```bash
cp .env.local.example .env.local
```

Rellenar todas las variables con los valores obtenidos en los pasos anteriores:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Price IDs
STRIPE_STARTER_MONTHLY_PRICE_ID=
STRIPE_STARTER_ANNUAL_PRICE_ID=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
STRIPE_AGENCY_MONTHLY_PRICE_ID=
STRIPE_AGENCY_ANNUAL_PRICE_ID=
STRIPE_PACK_50_PRICE_ID=
STRIPE_PACK_150_PRICE_ID=
STRIPE_PACK_500_PRICE_ID=
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

## 6. Bucket de imágenes del chat (chat-attachments)

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
