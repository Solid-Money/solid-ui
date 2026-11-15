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
 * produces. Pass a response reader to keep the deadline active while the body
 * is consumed.
 */
export function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response>;
export function fetchWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  readResponse: (response: Response) => Promise<T>,
): Promise<T>;
export async function fetchWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  readResponse?: (response: Response) => Promise<T>,
): Promise<Response | T> {
  const controller = new AbortController();
  const signal = init.signal;
  const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
  if (signal?.aborted) throw abortError();

  let rejectRequest!: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    rejectRequest = reject;
  });
  const abort = () => {
    rejectRequest(abortError());
    controller.abort();
  };
  signal?.addEventListener('abort', abort, { once: true });

  const timer = setTimeout(() => {
    rejectRequest(new FetchTimeoutError(timeoutMs));
    controller.abort();
  }, timeoutMs);

  try {
    const request = fetch(input, { ...init, signal: controller.signal }).then<Response | T>(
      response => (readResponse ? readResponse(response) : response),
    );
    return await Promise.race([request, interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
