import * as Sentry from '@sentry/react-native';

import { selectSelectedUser, useUserStore } from '@/store/useUserStore';

import type { User } from '@/lib/types';

/**
 * GlitchTip's idea of who is signed in.
 *
 * The selected user in the store is the one source every sign-in path ends at —
 * login, signup, a restored session, switching accounts — and every sign-out
 * path clears, so following it covers them all. Always the backend user id
 * (what the admin tools search by), never the Turnkey sub-organization id, and
 * never the email: `sendDefaultPii` stays off.
 */

export type SentryUser = { id: string; username?: string };

let current: SentryUser | null = null;
let installed = false;

/** The signed-in user as last given to Sentry, or null when signed out. */
export const getSentryUser = (): SentryUser | null => current;

export const syncSentryUser = (user: Pick<User, 'userId' | 'username'> | null | undefined) => {
  const next: SentryUser | null = user?.userId
    ? { id: user.userId, ...(user.username ? { username: user.username } : {}) }
    : null;
  if (next?.id === current?.id && next?.username === current?.username) return;

  current = next;
  try {
    Sentry.setUser(next);
  } catch {
    // Error tracking must never break sign-in.
  }
};

/** Follow the selected user from now on. Safe to call more than once. */
export const installSentryUserSync = () => {
  if (installed) return;
  installed = true;
  syncSentryUser(selectSelectedUser(useUserStore.getState()));
  useUserStore.subscribe(state => syncSentryUser(selectSelectedUser(state)));
};
