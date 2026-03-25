export const REDIRECTED_FROM_PARAM = 'redirected-from';

export const getSafeRedirectPath = (value?: string | string[]): string | undefined => {
  const redirectPath = Array.isArray(value) ? value[0] : value;

  if (!redirectPath) return undefined;
  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) return undefined;

  return redirectPath;
};
