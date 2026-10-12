import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { LifiSwapStatusValue } from '@/lib/types/lifi-swap';

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
}

/** After this long a swap is no longer polled; its activity row stays as it was. */
export const LIFI_SWAP_TRACK_WINDOW_MS = 24 * 60 * 60 * 1000;

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
          const cutoff = Date.now() - LIFI_SWAP_TRACK_WINDOW_MS;
          const swaps = Object.fromEntries(
            Object.entries(get().swaps).filter(([, swap]) => swap.submittedAt >= cutoff),
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
