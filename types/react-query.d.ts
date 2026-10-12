import type { ErrorAction } from '@/lib/errors/actions';

import '@tanstack/react-query';

/**
 * Typed `meta` for the global error handlers in `lib/errors/queryErrors.ts`
 * (TanStack Query v5 `Register`). Both are optional; leaving them out keeps
 * today's behaviour.
 */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** This query shows its own error UI; never toast when its refresh fails. */
      errorToast?: false;
      /** Toast title when a background refresh fails, e.g. "Couldn’t refresh your balance". */
      errorTitle?: string;
    };
    mutationMeta: {
      /**
       * Opt in to the shared failure UI. Money actions get the failure sheet,
       * the rest a toast. Leave unset when the call site shows its own error.
       */
      errorAction?: ErrorAction;
      errorTitle?: string;
    };
  }
}
