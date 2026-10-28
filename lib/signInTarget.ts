import { path } from '@/constants/path';

/**
 * Where a signed-out visitor was going, to finish there after they sign in or
 * sign up: a link into the app (the support-reply email, a push, a shared
 * link) otherwise lands on Home once the passkey prompt is done. Only an
 * in-app path counts, never another site. Plain Home is skipped (sign-in
 * lands there anyway), but Home with a query ("/?screen=card-info") opens a
 * view, so it is kept.
 */
export function signInTarget(pathname: string | null | undefined, search = ''): string | null {
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) return null;
  const query = !search || search === '?' ? '' : search.startsWith('?') ? search : `?${search}`;
  if (pathname === (path.HOME as string) && !query) return null;
  return `${pathname}${query}`;
}

/**
 * The query of the current route on native, where `usePathname()` has none:
 * expo-router's search params minus the route's own dynamic segments (`[id]`
 * in `activity/[id]`), which are already in the path.
 */
export function searchFromParams(
  params: Record<string, string | string[] | undefined>,
  routeSegments: readonly string[],
): string {
  const dynamic = new Set(
    routeSegments
      .map(segment => /^\[(?:\.\.\.)?([^\]]+)\]$/.exec(segment)?.[1])
      .filter((name): name is string => !!name),
  );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (dynamic.has(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === 'string') query.append(key, item);
    }
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}
