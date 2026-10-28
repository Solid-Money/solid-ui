import { path } from '@/constants/path';

/**
 * Where a signed-out visitor was going, to finish there after they sign in or
 * sign up: a link into the app (the support-reply email, a push, a shared
 * link) otherwise lands on Home once the passkey prompt is done. Only an
 * in-app path counts, never Home itself or another site.
 */
export function signInTarget(pathname: string | null | undefined, search = ''): string | null {
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) return null;
  if (pathname === (path.HOME as string)) return null;
  const query = !search || search === '?' ? '' : search.startsWith('?') ? search : `?${search}`;
  return `${pathname}${query}`;
}
