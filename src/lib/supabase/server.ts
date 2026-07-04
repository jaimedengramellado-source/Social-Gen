import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — can't set cookies, ignore
          }
        },
      },
    }
  );
}

// Deduplica auth.getUser() dentro de un mismo request: layout + page (+ componentes)
// suelen pedir el user por separado, y cada llamada intenta refrescar el token si
// expiró. Como estamos en Server Components no podemos persistir el token refrescado
// en cookies, así que la segunda llamada reintenta con el refresh token ya usado y
// Supabase responde "Invalid Refresh Token: Already Used". cache() asegura una sola
// llamada real por request.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Cliente con service role real. No debe leer cookies: si lleva la sesión del
// usuario, PostgREST ejecuta como `authenticated` y el service role no aplica.
export async function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
