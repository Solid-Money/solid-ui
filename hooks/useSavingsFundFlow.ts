import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import {
  getSavingsFundNetworks,
  getSavingsFundToken,
} from '@/components/Savings/SavingsFund/constants';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import {
  getRhinoExtraChains,
  isOfferedRhinoRow,
  resolveRhinoRow,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Failures here arrive as a rejected `Response` as often as an `Error`, and the
 * status is the part worth having: it separates a backend fault from a gateway
 * timeout when this shows up in analytics.
 */
const describeSessionError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const status = (error as { status?: number } | null)?.status;
  return status ? `HTTP ${status}` : 'Unknown error';
};

/**
 * Drives the savings direct-deposit screens ("Deposit to savings"): token →
 * network → deposit address, with the address prepared as soon as a network is
 * picked and the deposit polled for so the user lands on its activity the moment
 * it is seen on chain.
 *
 * Selection lives in the deposit store's `directDepositSession` slice, so the
 * three screens - which the deposit modal renders without props - all read the
 * same state, and closing the modal clears it with the rest of the flow.
 *
 * rhino.fi is the provider on every row but Fuse, USDT included (its soUSD route
 * takes USDT as USDC): the address step for those is the user's rhino.fi
 * address (`rhinoDeposit`), as it is for a "More networks" chain, and a
 * direct-deposit session is only ever minted for a Fuse row.
 */
export const useSavingsFundFlow = () => {
  const router = useRouter();
  const {
    session,
    rhinoDeposit,
    setModal,
    setDirectDepositSession,
    setRhinoDeposit,
    resetDepositFlow,
    setDepositFromSolid,
  } = useDepositStore(
    useShallow(state => ({
      session: state.directDepositSession,
      rhinoDeposit: state.rhinoDeposit,
      setModal: state.setModal,
      setDirectDepositSession: state.setDirectDepositSession,
      setRhinoDeposit: state.setRhinoDeposit,
      resetDepositFlow: state.resetDepositFlow,
      setDepositFromSolid: state.setDepositFromSolid,
    })),
  );
  const rhinoAssets = useOfferedRhinoDepositAssets();

  /** How one of the list's rows is served, into the vault the token funds. */
  const resolveRow = useCallback(
    (chainId: number, token: string) =>
      resolveRhinoRow(rhinoAssets, {
        chainId,
        destinationType: 'PROTOCOL',
        symbol: token,
        vault: getSavingsFundToken(token).vaultToken,
      }),
    [rhinoAssets],
  );

  const selectedToken = session.selectedToken ?? 'USDC';
  const selectedChainId = session.chainId;
  const depositAddress = session.walletAddress;

  const {
    mutate: prepareSession,
    isPending: isPreparingSession,
    isError: hasSessionError,
  } = useMutation({
    mutationFn: async ({ chainId, token }: { chainId: number; token: string }) => {
      const data = await withRefreshToken(() =>
        createDirectDepositSession(chainId, token, 'PROTOCOL'),
      );
      // A response without an address leaves the screen with nothing to show,
      // so it is a failure here rather than a success the UI cannot render.
      if (!data?.walletAddress) throw new Error('No deposit address returned');
      return data;
    },
    onSuccess: data => {
      setDirectDepositSession({
        walletAddress: data.walletAddress,
        clientTxId: data.clientTxId,
      });
    },
    onError: (error, { chainId, token }) => {
      track(TRACKING_EVENTS.DEPOSIT_DIRECT_SESSION_CREATION_FAILED, {
        deposit_method: 'savings_direct_deposit',
        chain_id: chainId,
        selected_token: token,
        error: describeSessionError(error),
      });
    },
  });

  /** A Fuse row's address: a direct-deposit session on that chain. */
  const startDirectSession = useCallback(
    (chainId: number, token: string) => {
      setRhinoDeposit(undefined);
      setDirectDepositSession({
        selectedToken: token,
        chainId,
        walletAddress: undefined,
      });
      prepareSession({ chainId, token });
    },
    [prepareSession, setDirectDepositSession, setRhinoDeposit],
  );

  /**
   * One of the list's own rows. A row rhino.fi has a route from into the vault
   * the token funds shows the rhino.fi address; a Fuse row mints a
   * direct-deposit session, as before. Any other row has no address (rhino.fi's
   * routes are not in, cannot be had, or have none from there): the list does
   * not offer it, and nothing is minted for it here either.
   */
  const selectNetwork = useCallback(
    (chainId: number, symbol?: string) => {
      const token = symbol ?? selectedToken;
      const row = resolveRow(chainId, token);
      if (!isOfferedRhinoRow(row)) return;

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        token_symbol: token,
        deposit_type: 'savings_direct_deposit',
        via_rhino: row.kind === 'rhino',
      });

      if (row.kind === 'rhino') {
        setDirectDepositSession({ selectedToken: token, chainId, walletAddress: undefined });
        setRhinoDeposit(row.selection);
      } else {
        startDirectSession(chainId, token);
      }
      setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
    },
    [
      resolveRow,
      selectedToken,
      setDirectDepositSession,
      setModal,
      setRhinoDeposit,
      startDirectSession,
    ],
  );

  /**
   * A "More networks" chain from under the list. The address step shows the
   * user's rhino.fi address for it, which fetches its own address; no
   * direct-deposit session is minted.
   */
  const selectRhinoNetwork = useCallback(
    (selection: RhinoDepositSelection) => {
      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: selection.chainId,
        rhino_chain: selection.chain,
        token_symbol: selection.tokenSymbol,
        deposit_type: 'savings_direct_deposit',
        via_rhino: true,
      });
      setDirectDepositSession({
        selectedToken: selection.tokenSymbol,
        chainId: undefined,
        walletAddress: undefined,
      });
      setRhinoDeposit(selection);
      setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
    },
    [setDirectDepositSession, setModal, setRhinoDeposit],
  );

  const selectToken = useCallback(
    (symbol: string) => {
      setRhinoDeposit(undefined);
      setDirectDepositSession({
        selectedToken: symbol,
        chainId: undefined,
        walletAddress: undefined,
      });

      // Tokens sent on a single chain (WFUSE) skip the one-row chain list, once
      // that row has an address, and unless "More networks" makes it a choice
      // again. Until rhino.fi's routes are in, or when they cannot be had or
      // have none, the list is where that is said.
      const networks = getSavingsFundNetworks(symbol);
      const extraChains = getRhinoExtraChains(rhinoAssets.assets, {
        destinationType: 'PROTOCOL',
        symbol,
        vault: getSavingsFundToken(symbol).vaultToken,
      });
      if (
        networks.length === 1 &&
        extraChains.length === 0 &&
        isOfferedRhinoRow(resolveRow(networks[0].chainId, symbol))
      ) {
        selectNetwork(networks[0].chainId, symbol);
        return;
      }

      setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_NETWORKS);
    },
    [
      resolveRow,
      rhinoAssets.assets,
      selectNetwork,
      setDirectDepositSession,
      setModal,
      setRhinoDeposit,
    ],
  );

  /** Re-runs the session request for the Fuse row already chosen. */
  const retryPrepareSession = useCallback(() => {
    if (!selectedChainId) return;
    prepareSession({ chainId: selectedChainId, token: selectedToken });
  }, [prepareSession, selectedChainId, selectedToken]);

  /** "Move from wallet" — the existing deposit-from-Solid form. */
  const moveFromWallet = useCallback(() => {
    setDepositFromSolid(true);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  }, [setDepositFromSolid, setModal]);

  /**
   * "Deposit from an external wallet" — the existing connect-wallet options
   * sub-screen. Mobile only: desktop connects from the options screen itself
   * (SavingsFundConnectWalletRow), which is all that sub-screen offered there.
   */
  const depositFromExternalWallet = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_EXTERNAL_WALLET_OPTIONS);
  }, [setModal]);

  /** The webhook saw the transfer — hand the user straight to its progress screen. */
  const openDetectedDeposit = useCallback(
    (clientTxId: string) => {
      setModal(DEPOSIT_MODAL.CLOSE);
      resetDepositFlow();
      router.push(`/activity/${clientTxId}`);
    },
    [resetDepositFlow, router, setModal],
  );

  return {
    selectedToken,
    selectedChainId,
    depositAddress,
    rhinoDeposit,
    isPreparingSession,
    hasSessionError,
    selectToken,
    selectNetwork,
    selectRhinoNetwork,
    retryPrepareSession,
    moveFromWallet,
    depositFromExternalWallet,
    openDetectedDeposit,
  };
};
