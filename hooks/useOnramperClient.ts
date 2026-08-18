import { useCallback, useEffect, useState } from 'react';

import useUser from '@/hooks/useUser';
import { initOnramper, isOnramperSupported } from '@/lib/onramper';

import type { OnramperClient } from '@onramper/onramper-react-native';

interface UseOnramperClientReturn {
  /** Initialized client, or `undefined` until the bootstrap resolves. */
  client: OnramperClient | undefined;
  isLoading: boolean;
  error: Error | undefined;
  /**
   * False on Android and web. Advisory only — it does not gate initialization,
   * so the bootstrap is still attempted (and surfaces via `error`) off iOS.
   */
  isAvailable: boolean;
  retry: () => void;
}

/**
 * Lazily bootstraps the Onramper SDK for the buy-crypto flow.
 *
 * Deliberately not wired into app/_layout.tsx: initialize() needs a session minted
 * for an authenticated user, and buy-crypto is geo-gated, so booting a native SDK at
 * launch would cost startup time for a flow most users never open. Mount this from
 * the buy-crypto entry point instead.
 *
 * Teardown is not on unmount — the client is a module singleton that may be shared by
 * sibling screens, so unmounting one must not release it from under another. It is
 * released on logout via `destroyOnramper()` in useUser's handleLogout.
 */
export default function useOnramperClient(): UseOnramperClientReturn {
  const { user } = useUser();

  const [client, setClient] = useState<OnramperClient>();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const isAvailable = isOnramperSupported;
  // The only hard requirement: the session is minted against the user's JWT.
  // Platform and geo deliberately don't gate this — an unsupported platform fails
  // in initOnramper() and surfaces as `error` rather than silently no-op'ing.
  const canInitialize = !!user;

  useEffect(() => {
    if (!canInitialize) return;

    let cancelled = false;

    setIsLoading(true);
    setError(undefined);

    initOnramper()
      .then(instance => {
        if (cancelled) return;
        setClient(instance);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    // Only stops this effect from writing to unmounted state. initOnramper() is
    // single-flight and its result is cached, so an in-flight bootstrap is left to
    // finish rather than being torn down.
    return () => {
      cancelled = true;
    };
  }, [canInitialize, attempt]);

  const retry = useCallback(() => {
    setAttempt(current => current + 1);
  }, []);

  return { client, isLoading, error, isAvailable, retry };
}
