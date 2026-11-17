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
  /**
   * The Safe that sent it, and the EntryPoint nonce it was sent with — a
   * decimal string, since the record is persisted as JSON and JSON has no
   * bigint.
   *
   * A user operation carries no expiry of ours, so "the bundler has no receipt
   * for it" never on its own means it cannot still land. Its nonce does: once
   * the Safe's nonce has moved past this one, nothing sent with it can ever be
   * included. See `settlePendingTierUpgrades`. Absent on records written before
   * it was kept; those fall back to the TTL alone, as they always did.
   */
  sender?: string;
  nonce?: string;
  /**
   * The latest Fuse block read before it was sent — a decimal string, like the
   * nonce. It cannot have been included before this block, so a search of the
   * chain for it starts here rather than at the start of the chain. Absent on
   * records written before it was kept.
   */
  block?: string;
  /**
   * Earlier operations this one replaced: sent from the same Safe with the
   * same nonce, newest first. Only one operation with a nonce can ever be
   * included, but until the nonce is used it is not known which — any of
   * these may still be the one that lands, and is confirmed as the tier it
   * paid for if it does.
   */
  replaced?: { userOpHash: `0x${string}`; tier: RewardsTier }[];
  /**
   * Set when settling found it has not landed and may be replaced: its nonce
   * unused, and the bundler no longer holding it or the hold over. There is
   * nothing to confirm, so no screen waits on it; the record stays until its
   * nonce is used — by it after all, or by the payment that replaces it.
   */
  replaceable?: boolean;
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
  /** It landed after all, so it is a payment to confirm again, not one to replace. */
  landed: (userOpHash: string, transactionHash: string) => void;
  /** Stamp the first refusal; later ones keep the original time. */
  rejected: (userOpHash: string, at: number) => void;
  markReplaceable: (userOpHash: string) => void;
  /**
   * Swap one record for another in a single write: an operation for the one
   * that replaced it, or a record for the one of its operations that landed.
   */
  replace: (userOpHash: string, upgrade: PendingTierUpgrade) => void;
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
          return {
            upgrades: {
              ...state.upgrades,
              [userOpHash]: { ...upgrade, transactionHash, replaceable: undefined },
            },
          };
        }),
      rejected: (userOpHash, at) =>
        set(state => {
          const upgrade = state.upgrades[userOpHash];
          if (!upgrade || upgrade.rejectedAt) return state;
          return { upgrades: { ...state.upgrades, [userOpHash]: { ...upgrade, rejectedAt: at } } };
        }),
      markReplaceable: userOpHash =>
        set(state => {
          const upgrade = state.upgrades[userOpHash];
          if (!upgrade || upgrade.replaceable) return state;
          return {
            upgrades: { ...state.upgrades, [userOpHash]: { ...upgrade, replaceable: true } },
          };
        }),
      replace: (userOpHash, upgrade) =>
        set(state => {
          const { [userOpHash]: _replaced, ...upgrades } = state.upgrades;
          return { upgrades: { ...upgrades, [upgrade.userOpHash]: upgrade } };
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
 *
 * Not one found `replaceable`: it never landed, so there is nothing to
 * confirm, and the screen goes back to paying — which replaces it.
 */
export const useHasPendingTierUpgrade = (userId: string | undefined): boolean =>
  usePendingTierUpgradeStore(
    state =>
      !!userId &&
      Object.values(state.upgrades).some(
        upgrade => upgrade.userId === userId && !upgrade.replaceable,
      ),
  );

/** One account's unconfirmed upgrades, oldest first. */
export const pendingTierUpgradesFor = (userId: string): PendingTierUpgrade[] =>
  Object.values(usePendingTierUpgradeStore.getState().upgrades)
    .filter(upgrade => upgrade.userId === userId)
    .sort((a, b) => a.submittedAt - b.submittedAt);
