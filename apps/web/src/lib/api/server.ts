import { verifiedAccessToken } from '@/lib/supabase/access-token';

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed: ${status}`);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await verifiedAccessToken();
  if (!token) throw new ApiError(401);
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new ApiError(503);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(503);
  }
  if (!response.ok) throw new ApiError(response.status);
  return (await response.json()) as T;
}
