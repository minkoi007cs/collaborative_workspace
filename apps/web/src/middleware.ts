import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseConfig } from './lib/supabase/config';

export async function middleware(request: NextRequest) {
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

export const config = { matcher: ['/app/:path*'] };
