import { NextResponse } from 'next/server';
import { ApiError, apiRequest } from '@/lib/api/server';

export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId))
    return new Response('Not found', { status: 404 });
  try {
    const { url } = await apiRequest<{ url: string }>(
      `/attachments/${attachmentId}/download-url`,
    );
    return NextResponse.redirect(url, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      return NextResponse.redirect(new URL('/login', _request.url));
    return new Response('File unavailable', {
      status: error instanceof ApiError ? error.status : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
