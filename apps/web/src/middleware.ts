import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { safeNextPath } from './lib/auth-next';
import { supabaseConfig } from './lib/supabase/config';

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'
  ) {
    const response = NextResponse.next({ request });
    const requested = request.nextUrl.searchParams.get('next');
    if (requested && safeNextPath(requested) !== '/app') {
      response.cookies.set('syncspace_auth_next', requested, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        maxAge: 600,
        path: '/',
      });
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  }
  const config = supabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        }
      },
    },
  });
  await client.auth.getClaims();
  return response;
}

export const config = { matcher: ['/app/:path*', '/login', '/signup'] };
