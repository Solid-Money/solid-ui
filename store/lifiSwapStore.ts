import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { LifiSwapPurpose, LifiSwapStatusValue } from '@/lib/types/lifi-swap';

/** A cross-chain swap whose source leg is mined and whose delivery we are waiting on. */
export interface TrackedLifiSwap {
  clientTxId: string;
  userId: string;
  txHash: string;
  fromChainId: number;
  toChainId: number;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  /** Quoted output, human units. The delivered amount replaces it once known. */
  toAmount: string;
  etaSeconds: number;
  submittedAt: number;
  status: LifiSwapStatusValue;
  substatus?: string;
  substatusMessage?: string;
  explorerLink?: string;
  receivingTxLink?: string;
  /** What the swap was for, when it was not a plain swap. */
  purpose?: LifiSwapPurpose;
  /** The quote's USD value of what was sent, as LI.FI priced it. */
  fromAmountUsd?: string;
  /** Set once whatever the swap was for has used it — a membership it paid. */
  consumed?: boolean;
}

/** After this long a swap is no longer polled; its activity row stays as it was. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a settled swap stays in the list for the status screen. */
export const LIFI_SWAP_SETTLED_RETENTION_MS = DAY_MS;

/**
 * When an unsettled swap is given up on. A bridge can sit unsettled for well
 * over a day (a slow refund, a stuck relayer), and polling has to continue
 * until LI.FI resolves it so the activity row settles. LI.FI settles or
 * refunds within days; this only bounds a hash it will never resolve.
 */
export const LIFI_SWAP_MAX_TRACK_MS = 30 * DAY_MS;

export const isLifiSwapSettled = (swap: Pick<TrackedLifiSwap, 'status'>) =>
  swap.status === 'DONE' || swap.status === 'FAILED' || swap.status === 'INVALID';

interface LifiSwapState {
  swaps: Record<string, TrackedLifiSwap>;
  /** The swap the status screen is showing. */
  activeClientTxId: string | undefined;
  actions: {
    track: (swap: TrackedLifiSwap) => void;
    update: (clientTxId: string, patch: Partial<TrackedLifiSwap>) => void;
    setActive: (clientTxId: string | undefined) => void;
    prune: () => void;
  };
}

export const useLifiSwapStore = create<LifiSwapState>()(
  persist(
    (set, get) => ({
      swaps: {},
      activeClientTxId: undefined,
      actions: {
        track: swap =>
          set({
            swaps: { ...get().swaps, [swap.clientTxId]: swap },
            activeClientTxId: swap.clientTxId,
          }),
        update: (clientTxId, patch) => {
          const existing = get().swaps[clientTxId];
          if (!existing) return;
          set({ swaps: { ...get().swaps, [clientTxId]: { ...existing, ...patch } } });
        },
        setActive: clientTxId => set({ activeClientTxId: clientTxId }),
        prune: () => {
          const age = (swap: TrackedLifiSwap) => Date.now() - swap.submittedAt;
          const swaps = Object.fromEntries(
            Object.entries(get().swaps).filter(([, swap]) =>
              isLifiSwapSettled(swap)
                ? age(swap) < LIFI_SWAP_SETTLED_RETENTION_MS
                : age(swap) < LIFI_SWAP_MAX_TRACK_MS,
            ),
          );
          set({ swaps });
        },
      },
    }),
    {
      name: USER.lifiSwapsStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.lifiSwapsStorageKey)),
      partialize: state => ({ swaps: state.swaps }) as LifiSwapState,
    },
  ),
);
