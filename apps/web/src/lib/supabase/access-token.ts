import { serverClient } from './server';

export async function verifiedAccessToken() {
  const client = await serverClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims) return null;
  const { data: sessionData } = await client.auth.getSession();
  return sessionData.session?.access_token ?? null;
}
