# CHECKLIST antes de Deploy — Social Gen

## Variables de entorno
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] `ANTHROPIC_API_KEY` configurada y con saldo
- [ ] `STRIPE_SECRET_KEY` configurada (usar `sk_live_` en producción)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` configurada
- [ ] `STRIPE_WEBHOOK_SECRET` configurada
- [ ] `NEXT_PUBLIC_APP_URL` apunta al dominio de producción
- [ ] Todos los `STRIPE_*_PRICE_ID` configurados

## Base de datos Supabase
- [ ] Schema SQL ejecutado en el proyecto de Supabase correcto
- [ ] RLS activado en todas las tablas
- [ ] Trigger `on_auth_user_created` activo
- [ ] Verificar: crear usuario de prueba y comprobar que se crea el profile

## Autenticación
- [ ] Login con email/password funciona
- [ ] Registro con email funciona (confirmar email llegado)
- [ ] Google OAuth configurado y funciona (si aplica)
- [ ] Redirect `/auth/callback` funciona
- [ ] Onboarding completa y marca `onboarding_completed = true`

## Generación de contenido (IA)
- [ ] `POST /api/ai/generate-ideas` devuelve 10 ideas
- [ ] Ideas tienen `viral_score`, `hook_type`, `content_style`
- [ ] `POST /api/ai/generate-script` devuelve guion completo con todas las secciones
- [ ] `hooks_variants` (hook comparator) presente en la respuesta
- [ ] `POST /api/ai/regenerate-section` regenera solo una sección
- [ ] `POST /api/ai/sorprendeme` genera 5 ideas sin formulario
- [ ] `POST /api/ai/analyze-channel` devuelve análisis
- [ ] `POST /api/ai/score-script` puntúa un guion pegado

## Sistema de créditos
- [ ] Perfil nuevo empieza con 10 créditos
- [ ] Créditos se descuentan correctamente en cada acción
- [ ] Error 402 al quedarse sin créditos
- [ ] Modal de upgrade aparece al llegar a 0 créditos
- [ ] Barra de créditos en sidebar muestra estado correcto
- [ ] Alerta ámbar al bajar de 20%, roja al bajar de 5%

## Stripe y pagos
- [ ] Checkout crea sesión y redirige a Stripe
- [ ] Pago con `4242 4242 4242 4242` en modo test funciona
- [ ] Webhook recibe `checkout.session.completed`
- [ ] Al completar pago, `plan` y `credits_*` se actualizan en profiles
- [ ] Portal de billing (`/api/stripe/portal`) funciona
- [ ] Packs de créditos one-time suman correctamente los créditos
- [ ] Cancelación de suscripción resetea a plan free

## UX y flujo
- [ ] Landing page carga correctamente con tipografía Instrument Serif
- [ ] Flujo completo: plataforma → preguntas → ideas → hook comparator → guion
- [ ] Regeneración individual de secciones funciona
- [ ] Hook Comparator muestra las 3 variantes
- [ ] URL pública `/share/[token]` accesible sin login
- [ ] Botón "Sorpréndeme" en dashboard funciona
- [ ] Trending topics pre-rellenan el flujo de creación
- [ ] Biblioteca muestra guiones e ideas guardadas
- [ ] Búsqueda en biblioteca funciona

## Mobile
- [ ] Bottom navigation visible en < 768px
- [ ] Sidebar oculto en mobile
- [ ] Flujo de creación usable en móvil
- [ ] Plataforma selector 2x2 en mobile

## Performance y seguridad
- [ ] API keys nunca expuestas al cliente
- [ ] Rate limiting activo en endpoints de IA
- [ ] RLS verifica usuario correcto en todas las queries
- [ ] No hay `console.log` con datos sensibles en producción
- [ ] `STRIPE_WEBHOOK_SECRET` verifica firma en cada webhook

## Deploy
- [ ] `pnpm build` sin errores
- [ ] Variables de entorno configuradas en plataforma de hosting (Vercel, etc.)
- [ ] Dominio configurado en `NEXT_PUBLIC_APP_URL`
- [ ] Webhook de Stripe actualizado con URL de producción
- [ ] `Redirect URLs` de Supabase incluye dominio de producción
