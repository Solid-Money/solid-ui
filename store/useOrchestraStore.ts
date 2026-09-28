import { create } from 'zustand';

import { OrchestraError } from '@/lib/orchestraErrors';

import type { DepositModal } from '@/lib/types';
import type { OrchestraOnrampOrder } from '@/lib/types/orchestra';

/**
 * Ephemeral state for the Orchestra Lightning onramp, shared across the
 * Add-funds modal steps (amount → invoice → status). Not persisted: it only
 * needs to survive step transitions within a single flow.
 *
 * The created order is kept here rather than in a react-query cache because the
 * `readToken` is the only thing that can read the order back, it is returned
 * exactly once by /onramp, and losing it on an unmount would leave a paid
 * invoice the app can no longer track.
 */
/** Which balance the deposit funds. Set by whichever entry point opened it. */
export type OrchestraDestination = 'wallet' | 'card';

interface OrchestraState {
  /** USD the user typed, as a string — "50.00". */
  amountUsd: string;
  /**
   * Wallet or card. Held here rather than inferred on the amount screen,
   * because only the entry point knows which balance the user asked to fund
   * and the screen itself is identical either way.
   */
  destination: OrchestraDestination;
  order: OrchestraOnrampOrder | null;
  /** The failure the error step renders; survives the step transition. */
  error: OrchestraError | null;
  /** The step the failure came from, so "Try again" returns there. */
  errorOrigin: DepositModal | null;
  setAmountUsd: (amountUsd: string) => void;
  setDestination: (destination: OrchestraDestination) => void;
  setOrder: (order: OrchestraOnrampOrder) => void;
  setError: (error: OrchestraError | null, origin?: DepositModal) => void;
  reset: () => void;
}

export const useOrchestraStore = create<OrchestraState>(set => ({
  amountUsd: '',
  destination: 'wallet',
  order: null,
  error: null,
  errorOrigin: null,
  setAmountUsd: amountUsd => set({ amountUsd }),
  setDestination: destination => set({ destination }),
  setOrder: order => set({ order }),
  setError: (error, origin) => set({ error, errorOrigin: origin ?? null }),
  // `destination` deliberately resets too: a reset happens when an entry point
  // starts a new deposit, and it sets the destination immediately after.
  reset: () =>
    set({ amountUsd: '', destination: 'wallet', order: null, error: null, errorOrigin: null }),
}));
