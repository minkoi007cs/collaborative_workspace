import { AuthForm } from '../auth-form';
import { safeNextPath } from '@/lib/auth-next';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="login"
      callbackError={params.error === 'callback'}
      nextPath={safeNextPath(params.next)}
    />
  );
}
