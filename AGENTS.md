<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-overview -->
# Viralcraft / Social Gen

Aplicación web para creadores de contenido en TikTok/Instagram. Asiste con ideas, guiones, hooks y estrategia mediante IA. Marca de producto: **"Social Gen"** (logo: "Social" en Instrument Serif normal + "Gen" en itálica en el color primary).

**Idioma del producto**: español. Todo copy de UI, placeholders, mensajes de error y comentarios visibles al usuario van en español. Variables, identifiers y commits en inglés.

**Stack**:
- Next.js 16.2.4 (App Router) + React 19.2 + TypeScript 5
- Tailwind CSS v4 (config en `globals.css` con `@theme`, no `tailwind.config.js`)
- Supabase (Auth + Postgres + Storage) vía `@supabase/ssr`
- Anthropic SDK (`@anthropic-ai/sdk` 0.92), modelo por defecto `claude-sonnet-5`
- Stripe (subs + créditos one-time)
- Radix UI primitives + `lucide-react` iconos + Framer Motion + Recharts
- Package manager: **pnpm** (`pnpm dev`, `pnpm build`, `pnpm lint`)
<!-- END:project-overview -->

<!-- BEGIN:repo-layout -->
# Layout del repo

```
src/
  app/
    (auth)/            # login, signup
    api/               # Route Handlers (App Router)
    crear/             # Chat de IA + modo guiado. Pantalla principal del producto.
    dashboard/  explorar/  biblioteca/  estadisticas/  calendario/  ajustes/
    layout.tsx page.tsx globals.css
  components/
    ui/                # Componentes base sobre Radix (button, input, dialog, etc.)
    shared/            # Header, nav, modales transversales
    creator/  explorar/  landing/  dashboard/
  lib/
    supabase/server.ts   # createClient() + createAdminClient() para Route Handlers/Server Components
    supabase/client.ts   # createClient() para Client Components
    anthropic.ts         # singleton del SDK Anthropic
    upload.ts            # helper de subida de imágenes
    utils.ts             # cn(), timeAgo(), ...
  types/                 # tipos globales (Profile, etc.)
supabase/schema.sql      # esquema completo (ejecutar en SQL Editor)
SETUP.md                 # pasos manuales de Supabase + Stripe + .env.local
```

**No es git**. No intentes `git commit` ni leas `git log`.
<!-- END:repo-layout -->

<!-- BEGIN:conventions -->
# Convenciones

**Tema visual**: variables CSS en [src/app/globals.css](src/app/globals.css) bajo `@theme`. Úsalas siempre, no hardcodees colores:
- `--color-background` #F8F7F4 (crema), `--color-foreground` #0D0D0D
- `--color-primary` #8C2230 (rojo/burdeos), `--color-primary-light` #F7DEE2
- `--color-border` #E5E5E5, `--color-muted` #F4F4F5, `--color-muted-foreground` #6B6B6B
- `--color-destructive` #DC2626, `--color-success` #059669
- Modo oscuro: clase `html.dark` con overrides en el mismo `globals.css`

**Fuentes** (cargadas en `app/layout.tsx` vía Next.js font loader):
- `var(--font-instrument-serif)` — serif elegante para titulares y logo
- `var(--font-inter)` — sans por defecto, ya aplicada en body

**Patrón de styling**: Tailwind className + `style={{ ... }}` cuando hace falta una variable CSS (`var(--color-X)`). Evita CSS modules y styled-components — no se usan.

**Focus ring**: `:focus-visible` global pinta outline en el color primary en botones/links/chips. **Inputs/textareas/selects están excluidos**: en formularios, indica foco con `focus-within:` en el wrapper (borde más oscuro + sombra suave).

**Auth en Route Handlers**:
```ts
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**RLS**: todas las tablas tienen Row Level Security. Nunca uses `createAdminClient()` salvo que necesites bypass explícito (webhooks de Stripe, jobs de admin).

**Endpoints IA con streaming**: `/api/ai/chat` devuelve `ReadableStream` consumido con `getReader()` en el cliente.

**Buckets de Storage**: privados por defecto, con policies por `auth.uid()` en prefijo de carpeta `{user_id}/`. Crea buckets desde el SQL Editor de Supabase, documenta el SQL en `SETUP.md`.
<!-- END:conventions -->

<!-- BEGIN:prompt-caching -->
# Prompt caching (Anthropic SDK)

**Aplica caching en TODAS las llamadas a `client.messages.{create,stream}`.** Reduce ~10× el coste de los tokens cacheados y baja latencia. Es invisible al usuario y "gratis" si se hace bien.

**Invariante**: el cache es un *prefix match*. Cualquier byte que cambie en el prefijo invalida todo lo que viene después. Orden de render: `tools` → `system` → `messages`.

**Patrón por defecto** — usa `cache_control` top-level (auto-coloca breakpoint en el último bloque cacheable):

```ts
const stream = await getAnthropicClient().messages.stream({
  model: "claude-sonnet-5",
  max_tokens: 1024,
  system: SYSTEM_PROMPT,                    // estable, idealmente >4096 tokens
  cache_control: { type: "ephemeral" },     // ← auto-cachea system (+tools si los hay)
  messages,                                 // historial conversacional, va después
});
```

**Mínimo cacheable en Haiku 4.5: 4096 tokens.** Si el `system` prompt es más corto, **no cachea y no avisa** — `usage.cache_creation_input_tokens` saldrá `0`. Si necesitas cachear pero el prompt es corto, infla con contexto reutilizable (guías de estilo, ejemplos few-shot, glosario del dominio) — no añadas relleno inútil.

**Anti-patrones que invalidan el cache silenciosamente** (busca esto antes de aprobar un PR que toque IA):
- `new Date().toISOString()`, `Date.now()`, `crypto.randomUUID()` interpolados en el `system`.
- `JSON.stringify(obj)` sin orden determinista (iterar `Set`, `Object.keys` sobre objeto mutable).
- Interpolar `userId`/`profileId` en el `system` → cada usuario tiene su propio prefix; no comparte cache entre usuarios. Mete esos datos en un `messages` posterior, no en el system.
- Cambiar la lista de `tools` (o reordenarla) entre requests de la misma conversación.

**Verificación**: tras un cambio que toque IA, en dev haz dos requests idénticas seguidas y mira `response.usage`:
- `cache_creation_input_tokens` > 0 en la 1ª → escribió el cache ✓
- `cache_read_input_tokens` > 0 en la 2ª → leyó del cache ✓
- Si la 2ª sale con `cache_read_input_tokens: 0` → hay un invalidador silencioso, audita.

**Cuándo NO cachear**: prompts que cambian completamente cada request (prefijo no reutilizable). Añadir `cache_control` ahí solo paga el premium de escritura sin lecturas.

**Multi-turno (chat con historial)**: pon el breakpoint en el último bloque del último turno usuario. Los breakpoints anteriores siguen siendo lecturas válidas — cada turno acumula hits. Máx 4 breakpoints por request.
<!-- END:prompt-caching -->

<!-- BEGIN:guardrails -->
# Reglas operativas

- **No uses Pages Router**. Todo es App Router.
- **No instales dependencias** sin justificación: lucide-react, framer-motion, radix-ui y recharts ya cubren la mayoría de necesidades. Antes de `pnpm add X`, comprueba que no exista equivalente.
- **No crees archivos de documentación** (`*.md`) salvo que el usuario lo pida, excepto `SETUP.md` si añades pasos manuales de infraestructura (bucket nuevo, env var nueva, etc.).
- **No añadas comentarios explicando qué hace el código** — solo el porqué cuando sea no-obvio.
- **Verificación**: tras cambios significativos, corre `pnpm build` y arregla errores de TS antes de cerrar. `pnpm lint` solo si tocas mucho.
- **Sin git**: no hagas commits.
- **Datos sensibles**: nunca leas ni commitees `.env.local`, claves de Stripe ni service role keys.
- **Autonomía**: una vez acordado un objetivo, ejecútalo entero sin pedir permiso paso a paso. No preguntes "¿procedo?", "¿paso al siguiente?" ni "¿quieres que haga X?" para cosas ya implícitas en la tarea acordada. Ante ambigüedades pequeñas, toma la decisión más conservadora y documéntala al final. Pregunta solo cuando: (a) la decisión cambia sustancialmente el alcance, (b) requiere una acción destructiva o irreversible, o (c) hay un trade-off real que el usuario debe elegir.
<!-- END:guardrails -->
