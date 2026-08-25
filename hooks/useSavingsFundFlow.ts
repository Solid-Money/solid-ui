import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { getSavingsFundNetworks } from '@/components/Savings/SavingsFund/constants';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
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
 */
export const useSavingsFundFlow = () => {
  const router = useRouter();
  const { session, setModal, setDirectDepositSession, resetDepositFlow, setDepositFromSolid } =
    useDepositStore(
      useShallow(state => ({
        session: state.directDepositSession,
        setModal: state.setModal,
        setDirectDepositSession: state.setDirectDepositSession,
        resetDepositFlow: state.resetDepositFlow,
        setDepositFromSolid: state.setDepositFromSolid,
      })),
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

  const selectNetwork = useCallback(
    (chainId: number, symbol?: string) => {
      const token = symbol ?? selectedToken;

      track(TRACKING_EVENTS.NETWORK_SELECTED, {
        chain_id: chainId,
        token_symbol: token,
        deposit_type: 'savings_direct_deposit',
      });

      setDirectDepositSession({
        selectedToken: token,
        chainId,
        walletAddress: undefined,
      });
      prepareSession({ chainId, token });
      setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_ADDRESS);
    },
    [prepareSession, selectedToken, setDirectDepositSession, setModal],
  );

  const selectToken = useCallback(
    (symbol: string) => {
      setDirectDepositSession({
        selectedToken: symbol,
        chainId: undefined,
        walletAddress: undefined,
      });

      // Tokens that exist on a single chain (FUSE) skip the one-row chain list.
      const networks = getSavingsFundNetworks(symbol);
      if (networks.length === 1) {
        selectNetwork(networks[0].chainId, symbol);
        return;
      }

      setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_NETWORKS);
    },
    [selectNetwork, setDirectDepositSession, setModal],
  );

  /** Re-runs the address request for the network already chosen. */
  const retryPrepareSession = useCallback(() => {
    if (!selectedChainId) return;
    prepareSession({ chainId: selectedChainId, token: selectedToken });
  }, [prepareSession, selectedChainId, selectedToken]);

  /** "Move from wallet or savings" — the existing deposit-from-Solid form. */
  const moveFromWallet = useCallback(() => {
    setDepositFromSolid(true);
    setModal(DEPOSIT_MODAL.OPEN_FORM);
  }, [setDepositFromSolid, setModal]);

  /** "Deposit from an external wallet" — the existing connect-wallet options. */
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
    isPreparingSession,
    hasSessionError,
    selectToken,
    selectNetwork,
    retryPrepareSession,
    moveFromWallet,
    depositFromExternalWallet,
    openDetectedDeposit,
  };
};
