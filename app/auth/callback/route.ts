import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// `next` solo admite rutas internas: empieza por `/` y no por `//` ni `/\`.
const safeNext = (value: string | null) =>
  value &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.startsWith('/\\')
    ? value
    : '/';

const toAuthError = (origin: string, code: string) =>
  NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(code)}`);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));

  // El proveedor o Supabase pueden devolver el error en la URL (p. ej. OAuth cancelado).
  const providerError =
    searchParams.get('error_code') ?? searchParams.get('error');
  if (providerError) return toAuthError(origin, providerError);

  const code = searchParams.get('code');
  if (!code) return toAuthError(origin, 'bad_oauth_callback');

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toAuthError(origin, error.code ?? 'bad_oauth_callback');

  return NextResponse.redirect(`${origin}${next}`);
}
