import { useEffect } from 'react';

import { HomeGateState, noteHomeGates, noteHomeUnmounted } from '@/lib/homeLoadTiming';

/**
 * Reports the home screen's loading gate to lib/homeLoadTiming each time a part
 * of it starts or stops loading, so launches and returns to the app can say
 * how long balances took and which part held them up.
 *
 * `lastKnownSavedAt` is when the figures standing in for skeletons were saved,
 * or undefined when the user is looking at skeletons.
 */
export const useHomeLoadTracking = ({
  gates,
  lastKnownSavedAt,
}: {
  gates: HomeGateState;
  lastKnownSavedAt?: number;
}): void => {
  const { tokens, vaultBalance, savings, card, portfolio } = gates;

  useEffect(() => {
    noteHomeGates({ tokens, vaultBalance, savings, card, portfolio }, lastKnownSavedAt);
  }, [tokens, vaultBalance, savings, card, portfolio, lastKnownSavedAt]);

  useEffect(() => noteHomeUnmounted, []);
};
