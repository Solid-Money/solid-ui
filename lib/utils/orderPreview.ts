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
  if (!Array.isArray(lines) || lines.some(line => typeof line !== 'object' || line === null)) {
    throw new Error(`Invalid ${what} preview: no lines`);
  }
  return body as T;
};

/**
 * A saved-order body (`GET`/`POST /wirex/spend-order` or `/wirex/collateral-order`), checked before
 * the hooks normalise it: each named field must be absent or an array of strings, so a malformed
 * answer reaches the query's error path instead of throwing in render. Missing fields stay valid —
 * an answer with exclusions and no order is a real one.
 */
export const requireOrderArrays = <T extends object>(
  body: unknown,
  fields: readonly string[],
  what: string,
): T => {
  if (typeof body !== 'object' || body === null) throw new Error(`Invalid ${what}: not an object`);
  for (const field of fields) {
    const value = (body as Record<string, unknown>)[field];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
      throw new Error(`Invalid ${what}: ${field} is not a list of keys`);
    }
  }
  return body as T;
};
