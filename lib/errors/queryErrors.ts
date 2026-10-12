import { toUserError } from '@/lib/errors/classify';
import { showError, showErrorToast } from '@/lib/errors/index';

import type { Mutation, Query } from '@tanstack/react-query';

/** Kinds worth a "couldn't refresh" toast. A 4xx is an answer, not a failed refresh. */
const REFRESH_TOAST_KINDS = new Set(['offline', 'timeout', 'server', 'blockchain', 'unknown']);

/** One refresh toast at a time across the app, however many queries fail together. */
const REFRESH_TOAST_COOLDOWN_MS = 60_000;
let lastRefreshToastAt = 0;

/** Queries already toasted for, until they succeed again: a broken query toasts once. */
const toastedQueries = new Set<string>();

/**
 * QueryCache `onError`: runs once per failed query, however many components
 * observe it.
 *
 * Only a failed *background* refetch gets a toast, i.e. one whose data is
 * already on screen (TkDodo, "React Query Error Handling"). An initial load has
 * nothing to show and renders its own error state; a toast on top would just
 * repeat it.
 */
export const handleQueryError = (error: unknown, query: Query<unknown, unknown, unknown>) => {
  if (query.state.data === undefined || query.meta?.errorToast === false) return;
  if (toastedQueries.has(query.queryHash)) return;

  const userError = toUserError(error, { action: 'refresh' });
  if (!REFRESH_TOAST_KINDS.has(userError.kind)) return;

  const now = Date.now();
  if (now - lastRefreshToastAt < REFRESH_TOAST_COOLDOWN_MS) return;
  lastRefreshToastAt = now;
  toastedQueries.add(query.queryHash);

  const isConnectivity = userError.kind === 'offline' || userError.kind === 'timeout';
  void showErrorToast(error, {
    action: 'refresh',
    title: query.meta?.errorTitle,
    // Polling picks the query back up on its own; the user needn't do anything.
    body: isConnectivity ? 'Check your connection. We’ll keep trying.' : undefined,
  });
};

/** QueryCache `onSuccess`: a recovered query may toast again if it breaks later. */
export const handleQuerySuccess = (_data: unknown, query: Query<unknown, unknown, unknown>) => {
  toastedQueries.delete(query.queryHash);
};

/**
 * MutationCache `onError`: the safety net for mutations that opt in with
 * `meta: { errorAction }`.
 *
 * Opt-in, not opt-out, because the global callback always runs and can't see a
 * call site's own `mutate(…, { onError })` or a `try/catch` around
 * `mutateAsync`; most mutations in this app already show their own error, and a
 * default toast would double every one of them.
 */
export const handleMutationError = (
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
) => {
  const action = mutation.meta?.errorAction;
  if (!action) return;
  void showError(error, { action, title: mutation.meta?.errorTitle });
};
