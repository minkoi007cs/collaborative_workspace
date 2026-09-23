import { type NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const client = await serverClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL('/app', request.url));
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }
  }
  return NextResponse.redirect(new URL('/login?error=callback', request.url));
}
