import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';

import type { RewardsTier } from '@/lib/types';

/**
 * A `transfer`-mode upgrade that was sent but not yet confirmed to the backend.
 *
 * Unlike a module subscription, where the backend takes the money and a retry
 * only re-signs a mandate, this one pays the treasury from the Safe itself. A
 * retry after a lost confirm — or after a receipt wait that gave up — would pay
 * a second time. The record is what makes the next press finish the first
 * payment instead of sending another.
 */
export interface PendingTierUpgrade {
  userOpHash: `0x${string}`;
  /** Whose upgrade it is. */
  userId: string;
  /** When it was sent, ms since epoch. */
  submittedAt: number;
  tier: RewardsTier;
  /** Set once the transaction is known to have landed. */
  transactionHash?: string;
  /**
   * When the backend first refused to start a membership from this payment,
   * ms since epoch. The money is at the treasury and support has been alerted;
   * the record is kept a while so a retry cannot pay again before they act.
   */
  rejectedAt?: number;
}

interface PendingTierUpgradeState {
  /** By user operation hash. */
  upgrades: Record<string, PendingTierUpgrade>;
  remember: (upgrade: PendingTierUpgrade) => void;
  landed: (userOpHash: string, transactionHash: string) => void;
  /** Stamp the first refusal; later ones keep the original time. */
  rejected: (userOpHash: string, at: number) => void;
  forget: (userOpHash: string) => void;
}

const PENDING_TIER_UPGRADE_STORAGE_KEY = 'pending-tier-upgrade-storage';

/** Persisted, so a payment sent just before the app was killed is still finished, not repeated. */
export const usePendingTierUpgradeStore = create<PendingTierUpgradeState>()(
  persist(
    set => ({
      upgrades: {},
      remember: upgrade =>
        set(state => ({ upgrades: { ...state.upgrades, [upgrade.userOpHash]: upgrade } })),
      landed: (userOpHash, transactionHash) =>
        set(state => {
          const upgrade = state.upgrades[userOpHash];
          if (!upgrade) return state;
          return { upgrades: { ...state.upgrades, [userOpHash]: { ...upgrade, transactionHash } } };
        }),
      rejected: (userOpHash, at) =>
        set(state => {
          const upgrade = state.upgrades[userOpHash];
          if (!upgrade || upgrade.rejectedAt) return state;
          return { upgrades: { ...state.upgrades, [userOpHash]: { ...upgrade, rejectedAt: at } } };
        }),
      forget: userOpHash =>
        set(state => {
          if (!state.upgrades[userOpHash]) return state;
          const { [userOpHash]: _forgotten, ...upgrades } = state.upgrades;
          return { upgrades };
        }),
    }),
    {
      name: PENDING_TIER_UPGRADE_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage(PENDING_TIER_UPGRADE_STORAGE_KEY)),
    },
  ),
);

/**
 * Whether an account has an upgrade payment still to confirm, for a screen
 * that has to re-render when one is remembered or settled.
 */
export const useHasPendingTierUpgrade = (userId: string | undefined): boolean =>
  usePendingTierUpgradeStore(
    state => !!userId && Object.values(state.upgrades).some(upgrade => upgrade.userId === userId),
  );

/** One account's unconfirmed upgrades, oldest first. */
export const pendingTierUpgradesFor = (userId: string): PendingTierUpgrade[] =>
  Object.values(usePendingTierUpgradeStore.getState().upgrades)
    .filter(upgrade => upgrade.userId === userId)
    .sort((a, b) => a.submittedAt - b.submittedAt);
