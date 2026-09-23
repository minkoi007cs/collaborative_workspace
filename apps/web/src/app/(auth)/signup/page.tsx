import { AuthForm } from '../auth-form';
import { safeNextPath } from '@/lib/auth-next';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="signup" nextPath={safeNextPath(params.next)} />;
}
