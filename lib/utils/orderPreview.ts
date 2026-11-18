/**
 * A spend-order or collateral-order preview body, checked before the screen draws it: the preview
 * maps over `lines`, so a body without that array would throw mid-render rather than reach the
 * query's error path. An empty array is a valid answer (nothing to pay or lock from the order).
 */
export const requirePreviewLines = <T extends { lines: readonly unknown[] }>(
  body: unknown,
  what: string,
): T => {
  const lines =
    typeof body === 'object' && body !== null ? (body as { lines?: unknown }).lines : undefined;
  if (!Array.isArray(lines)) throw new Error(`Invalid ${what} preview: no lines`);
  return body as T;
};
