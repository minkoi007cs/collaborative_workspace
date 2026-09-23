import { AuthForm } from '../auth-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="login" callbackError={params.error === 'callback'} />;
}
