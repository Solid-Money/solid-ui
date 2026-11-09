import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import {
  resolveRhinoRow,
  RhinoAssetsState,
  RhinoDepositSelection,
  RhinoRowState,
} from '@/lib/rhinoDeposit';
import { useDepositStore } from '@/store/useDepositStore';

/** What "Deposit directly" funds: USDC and USDT both mint soUSD. */
export const DEPOSIT_DIRECTLY_VAULT = 'soUSD';

/**
 * How a (chain, token) pairing of the savings "Deposit directly" screens is
 * served, as on "Deposit to savings": rhino.fi's soUSD route on every chain but
 * Fuse (USDT included, which it deposits as USDC), and our own direct-deposit
 * session on Fuse. Anything else has no address, and is not offered.
 */
export const resolveDepositDirectlyRow = (
  rhino: RhinoAssetsState,
  chainId: number,
  token: string,
): RhinoRowState =>
  resolveRhinoRow(rhino, {
    chainId,
    destinationType: 'PROTOCOL',
    symbol: token,
    vault: DEPOSIT_DIRECTLY_VAULT,
  });

/**
 * The tokens a chain of the "Deposit directly" list is offered with, of those
 * it carries: the ones with an address. A chain with none is not offered.
 */
export const getDepositDirectlyTokens = (
  rhino: RhinoAssetsState,
  chainId: number,
  tokens: readonly string[],
): { token: string; state: RhinoRowState }[] =>
  tokens.map(token => ({ token, state: resolveDepositDirectlyRow(rhino, chainId, token) }));

/** The "Deposit directly" screens' side of rhino.fi: how a row is served, and opening it. */
export const useDepositDirectlyRhino = () => {
  const rhino = useOfferedRhinoDepositAssets();
  const { setModal, clearDirectDepositSession, setDirectDepositSession, setRhinoDeposit } =
    useDepositStore(
      useShallow(state => ({
        setModal: state.setModal,
        clearDirectDepositSession: state.clearDirectDepositSession,
        setDirectDepositSession: state.setDirectDepositSession,
        setRhinoDeposit: state.setRhinoDeposit,
      })),
    );

  const resolve = useCallback(
    (chainId: number, token: string) => resolveDepositDirectlyRow(rhino, chainId, token),
    [rhino],
  );

  /**
   * The address step for a row rhino.fi serves: the user's rhino.fi address for
   * it. Nothing of a direct-deposit session is kept, so the address step has no
   * session to poll or delete, and none is minted.
   */
  const openRhino = useCallback(
    (selection: RhinoDepositSelection) => {
      clearDirectDepositSession();
      setDirectDepositSession({ chainId: selection.chainId, selectedToken: selection.tokenSymbol });
      setRhinoDeposit(selection);
      setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
    },
    [clearDirectDepositSession, setDirectDepositSession, setModal, setRhinoDeposit],
  );

  /** Before a Fuse row mints its session: no rhino.fi address is left showing. */
  const clearRhino = useCallback(() => setRhinoDeposit(undefined), [setRhinoDeposit]);

  return { rhino, resolve, openRhino, clearRhino };
};
