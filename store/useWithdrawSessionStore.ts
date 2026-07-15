import deepMerge from 'lodash.merge';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { VaultKey } from '@/constants/withdraw';
import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';

/**
 * Two-step vaults (soUSD, soETH) bridge Fuse -> Ethereum in step 1 and withdraw
 * on Ethereum in step 2. If the user closes the flow after step 1, the bridged
 * funds are sitting on Ethereum waiting to be withdrawn. We persist that
 * unfinished withdraw so the flow can resume directly on step 2 (prefilled,
 * step 1 disabled) instead of the user having to rediscover that they must
 * switch to the Ethereum-side token to continue.
 */
export interface WithdrawSession {
  /** Safe address the bridged funds belong to. */
  address: string;
  /** Vault being withdrawn (only bridging vaults: USD, ETH). */
  vault: VaultKey;
  /** Amount bridged in step 1 — prefilled and withdrawn in step 2. */
  amount: string;
  /** Asset the user receives on completion (for display). */
  destinationSymbol: string;
  createdAt: number;
}

/** How long an unfinished withdraw is offered for resume before it is dropped. */
export const WITHDRAW_SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const isFresh = (session: WithdrawSession) => Date.now() - session.createdAt < WITHDRAW_SESSION_TTL;

/**
 * Pure selector for the (still valid) session of a vault. Kept outside the
 * store so components can derive reactively from the `sessions` map.
 */
export const selectWithdrawSession = (
  sessions: Partial<Record<VaultKey, WithdrawSession>>,
  vault: VaultKey | null | undefined,
  address?: string,
): WithdrawSession | null => {
  if (!vault) return null;
  const session = sessions[vault];
  if (!session || !isFresh(session)) return null;
  if (address && session.address.toLowerCase() !== address.toLowerCase()) return null;
  return session;
};

interface WithdrawSessionState {
  sessions: Partial<Record<VaultKey, WithdrawSession>>;
  setSession: (session: WithdrawSession) => void;
  clearSession: (vault: VaultKey) => void;
}

export const useWithdrawSessionStore = create<WithdrawSessionState>()(
  persist(
    set => ({
      sessions: {},
      setSession: session =>
        set(state => ({ sessions: { ...state.sessions, [session.vault]: session } })),
      clearSession: vault =>
        set(state => {
          const sessions = { ...state.sessions };
          delete sessions[vault];
          return { sessions };
        }),
    }),
    {
      name: USER.unstakeStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.unstakeStorageKey)),
      merge: (persistedState, currentState) => deepMerge(currentState, persistedState),
      // Drop expired sessions when writing to storage.
      partialize: state => ({
        sessions: Object.fromEntries(
          Object.entries(state.sessions).filter(([, session]) => session && isFresh(session)),
        ) as Partial<Record<VaultKey, WithdrawSession>>,
      }),
    },
  ),
);
