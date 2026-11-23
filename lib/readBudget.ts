/** Thrown by {@link withBudget} when the work outlives its time budget. */
export class ReadBudgetExceededError extends Error {
  constructor(ms: number) {
    super(`Read took longer than ${ms}ms`);
    this.name = 'ReadBudgetExceededError';
  }
}

/**
 * `promise`, or a ReadBudgetExceededError once `ms` have passed.
 *
 * Bounds how long a caller waits, not the work itself: the underlying request
 * keeps running (and still warms whatever cache it fills), it just no longer
 * holds up the result that was waiting on it.
 */
export const withBudget = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ReadBudgetExceededError(ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

/** Like {@link withBudget}, resolving to `fallback` instead when the budget runs out. */
export const withinBudgetOr = async <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> => {
  try {
    return await withBudget(promise, ms);
  } catch (error) {
    if (error instanceof ReadBudgetExceededError) {
      console.warn(`[read-budget] gave up after ${ms}ms`);
      return fallback;
    }
    throw error;
  }
};
