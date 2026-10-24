import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rutas que exigen sesión → destino sin sesión. Comparación por ruta exacta:
// /auth y /auth/callback deben seguir siendo públicas. Es un chequeo de
// navegación, no de autorización: los datos los protege RLS.
const PROTECTED_ROUTES: Record<string, string> = {
  '/account': '/auth',
  '/auth/reset': '/auth?error=reset_no_session',
};

// Jugar exige sesión: /games/<id>/play (con o sin barra final). La ficha del
// juego (/games/<id>) y el leaderboard siguen siendo públicos.
const PLAY_ROUTE = /^\/games\/[^/]+\/play\/?$/;
const PLAY_REDIRECT = '/auth?error=play_requires_session';

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Valida el JWT (y refresca la sesión si hace falta). No usar getSession()
  // en el servidor: lee la cookie sin validarla.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const redirectTo =
    PROTECTED_ROUTES[pathname] ??
    (PLAY_ROUTE.test(pathname) ? PLAY_REDIRECT : undefined);
  if (redirectTo && !data?.claims) {
    const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
    // Conserva las cookies que setAll haya refrescado o borrado.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
};
