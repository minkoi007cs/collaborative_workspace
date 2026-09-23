import { type NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth-next';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const client = await serverClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const nextPath = safeNextPath(
        request.cookies.get('syncspace_auth_next')?.value,
      );
      const response = NextResponse.redirect(new URL(nextPath, request.url));
      response.headers.set('Cache-Control', 'private, no-store');
      response.cookies.delete('syncspace_auth_next');
      return response;
    }
  }
  return NextResponse.redirect(new URL('/login?error=callback', request.url));
}
