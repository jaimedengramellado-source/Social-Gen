---
name: verify
description: Cómo verificar cambios de esta app en runtime (dev server + Playwright MCP + Supabase MCP)
---

# Verificar Social Flamingo en local

## Servidor
- Suele haber ya un `next dev` corriendo en `http://localhost:3000` (el de la sesión del usuario). Comprueba antes de lanzar `pnpm dev`: si el puerto está ocupado por otro dev server del mismo directorio, reutilízalo — no lo mates.

## Sesión autenticada
- El navegador de Playwright MCP normalmente conserva la sesión iniciada de la cuenta de test (`jaime.dm.gdm@gmail.com`; contraseña en la memoria `test-credentials`). Navega directo a la ruta protegida; solo haz login si redirige a `/login`.

## Flujos con estado de BD (ej. onboarding)
1. Captura el estado previo del usuario de test con `mcp__supabase__execute_sql` (profiles + filas que el flujo vaya a tocar).
2. Ajusta el flag que abre el flujo (ej. `onboarding_completed = false`).
3. Conduce el flujo con Playwright y verifica el resultado en BD con SQL.
4. **Restaura siempre**: borra filas creadas por el test y devuelve el perfil a sus valores originales.

## Gotchas
- Los screenshots de Playwright MCP se guardan en la raíz del repo (`./*.png`) — bórralos al terminar. `.playwright-mcp/` ya está en `.gitignore`.
- Los consumidores de `channels` usan `.order(created_at desc).limit(1).single()`: una fila de test se convierte en "el canal" del usuario hasta que la borres.
