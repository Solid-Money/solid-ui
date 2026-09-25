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
interface OrchestraState {
  /** USD the user typed, as a string — "50.00". */
  amountUsd: string;
  order: OrchestraOnrampOrder | null;
  /** The failure the error step renders; survives the step transition. */
  error: OrchestraError | null;
  /** The step the failure came from, so "Try again" returns there. */
  errorOrigin: DepositModal | null;
  setAmountUsd: (amountUsd: string) => void;
  setOrder: (order: OrchestraOnrampOrder) => void;
  setError: (error: OrchestraError | null, origin?: DepositModal) => void;
  reset: () => void;
}

export const useOrchestraStore = create<OrchestraState>(set => ({
  amountUsd: '',
  order: null,
  error: null,
  errorOrigin: null,
  setAmountUsd: amountUsd => set({ amountUsd }),
  setOrder: order => set({ order }),
  setError: (error, origin) => set({ error, errorOrigin: origin ?? null }),
  reset: () => set({ amountUsd: '', order: null, error: null, errorOrigin: null }),
}));
