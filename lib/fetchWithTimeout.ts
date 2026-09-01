/** Thrown when a request outlives the deadline `fetchWithTimeout` gave it. */
export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * `fetch` with a deadline.
 *
 * Nothing times out a fetch on its own, so a request whose response is the only
 * thing a screen can render will keep that screen loading for as long as the
 * backend takes — which is how a slow dependency turns into a permanent spinner.
 *
 * The rejection is a `FetchTimeoutError`, not the bare `AbortError` an abort
 * produces: callers treat `AbortError` as a superseded request rather than a
 * failure, so a timeout raised that way would be swallowed.
 */
export const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
