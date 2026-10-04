import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData, erc20Abi } from 'viem';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { confirmRainRtf, getRainRtfStatus } from '@/lib/api';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider, RainRtfChain, RainRtfStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { selectRtfChains, shouldOfferRtf } from '@/lib/utils/realTimeFunding';
import { getChain } from '@/lib/wagmi';

export const RAIN_RTF_QUERY_KEY = 'rainRealTimeFunding';

/** How long the status is trusted before it is asked again. */
const STALE_MS = 60 * 1000;

interface RainRealTimeFunding {
  /**
   * Whether to render the "Real-Time Funding" row on the card screen.
   *
   * True only when every one of these holds: the card is a Rain card, Rain has
   * enabled RTF for the tenant, this cardholder is eligible, and at least one
   * chain is still missing a healthy allowance. It goes false the moment the
   * approval lands, which is the point — the row is a task, not a setting.
   */
  shouldOffer: boolean;
  /** The full status, once the backend has answered. */
  status: RainRtfStatus | undefined;
  /**
   * The chain the approve button acts on.
   *
   * One rather than a picker: a cardholder with contracts on several chains
   * has no basis for choosing between them, and "which chain is my card on"
   * is not a question to put to them. The first unapproved chain is taken,
   * and the rest come up on the next open — approving one at a time is also
   * one signature at a time, which is what a wallet can actually do.
   */
  chain: RainRtfChain | undefined;
  isLoading: boolean;
  isApproving: boolean;
  error: string | undefined;
  clearError: () => void;
  /**
   * Grant the allowance for {@link chain} and record the consent.
   *
   * Resolves `true` when the authorization is recorded, `false` when the
   * cardholder dismissed the signature prompt — a dismissal is not a failure
   * and must not be reported as one.
   */
  approve: (termsVersion: string) => Promise<boolean>;
}

/**
 * Rain Real-Time Funding, end to end.
 *
 * ## What approving actually is
 *
 * One ERC-20 `approve` per spender, batched into a single user operation from
 * the cardholder's Safe, each for `uint256` max.
 *
 * There are two spenders while Rain migrates to reversal-enabled collateral
 * contracts, and approving both is deliberate rather than belt-and-braces:
 *
 *  - The **collateral contract** (`proxyAddress`) is the spender on
 *    reversal-enabled (v2.04) contracts. It is what lets funds pulled at
 *    authorization be returned on-chain on a reversal or under-capture.
 *  - The **operator** is the spender before that switch.
 *
 * Rain's upgrade guide requires the new approval to be in place *before* the
 * cut-over and the old one to stay until Rain confirms it is complete.
 * Approving both means the cut-over — which happens server-side at Rain, with
 * no signal to this app — is invisible to the cardholder in either direction.
 * The backend decides which spenders to send; this hook never invents one.
 *
 * ## Why the amount is unlimited
 *
 * Rain recommends `uint256` max and the alternative is worse than it sounds. A
 * finite allowance is consumed by ordinary spending, and the first
 * authorization past the end of it is declined — at a till, with nothing in
 * the app to explain it and no way for the cardholder to connect the two. The
 * modal says plainly what is being granted and that it can be revoked, which
 * is the honest version of this trade rather than a smaller number that
 * quietly breaks later.
 *
 * ## Why the gate is the backend and not a chain read here
 *
 * `shouldOffer` comes from the status endpoint, which reads the allowances
 * server-side. A read from the app would mean a slow or failing RPC hides the
 * row from somebody who needs it, or shows it to somebody who does not and
 * hands them a transaction to pay for. The chain is still authoritative — it
 * is what the backend reads, and it reads it again on confirm.
 */
export const useRainRealTimeFunding = (): RainRealTimeFunding => {
  const { user, safeAA } = useUser();
  const { provider } = useCardProvider();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();

  const isRainCard = provider === CardProvider.RAIN;

  const { data: status, isLoading } = useQuery({
    queryKey: [RAIN_RTF_QUERY_KEY, user?.userId],
    queryFn: () => withRefreshToken(() => getRainRtfStatus()),
    enabled: Boolean(user?.userId) && isRainCard,
    staleTime: STALE_MS,
    // A gate that retries forever keeps the row hidden for the same length of
    // time either way; one retry covers a transient blip without holding the
    // query pending.
    retry: 1,
  });

  // Selection and the offer gate live in `lib/utils/realTimeFunding` rather
  // than here, so they are unit testable: both are load-bearing — one decides
  // what gets approved, the other whether the cardholder is ever asked — and
  // this hook's import graph does not load under jest-expo.
  const { chain } = useMemo(() => selectRtfChains(status), [status]);

  const approveMutation = useMutation({
    mutationFn: async (termsVersion: string) => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      if (!status || !chain) {
        throw new Error('Real-Time Funding is not available for this card right now.');
      }

      const viemChain = getChain(chain.chainId);
      if (!viemChain) {
        // A chain the backend offers that this build cannot address. Rain adds
        // chains during the beta and the app can be weeks behind, so this is a
        // normal state to reach — and it has to fail loudly rather than fall
        // back to another chain, which would approve the wrong token on the
        // wrong network and look like success.
        throw new Error(
          `${chain.name} isn’t supported by this version of the app. Please update and try again.`,
        );
      }

      // Only the spenders that still need it. Re-approving one that is already
      // at max is a transaction the cardholder pays for and gains nothing
      // from, and after a partially-landed batch it is the difference between
      // resuming and starting over.
      const pending = chain.spenders.filter(spender => !spender.isApproved);
      const transactions = pending.map(spender => ({
        to: chain.tokenAddress as Address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender.address as Address, BigInt(status.maxAllowance)],
        }),
        value: 0n,
      }));

      let transactionHash: string | undefined;

      // Every spender already approved while the status said otherwise — the
      // confirm after an earlier attempt never landed, most likely. Recording
      // it is exactly the fix, so this falls through to the confirm rather
      // than raising at a cardholder whose wallet is already correct.
      if (transactions.length > 0) {
        const smartAccountClient = await safeAA(viemChain, user.suborgId, user.signWith);

        const result = await executeTransactions(
          smartAccountClient,
          transactions,
          'Failed to approve Real-Time Funding',
          viemChain,
        );

        if (result === USER_CANCELLED_TRANSACTION) {
          track(TRACKING_EVENTS.CARD_RTF_APPROVE_CANCELLED, {
            chain_id: chain.chainId,
          });
          return null;
        }

        transactionHash = result.transactionHash;
      }

      // The consent is the half of this the chain cannot hold. Sent after the
      // approval rather than before so a cardholder who dismissed the
      // signature prompt leaves no record saying they authorized anything.
      await withRefreshToken(() =>
        confirmRainRtf({
          chainId: chain.chainId,
          termsAccepted: true,
          termsVersion,
          ...(transactionHash ? { transactionHash } : {}),
        }),
      );

      return { chainId: chain.chainId, transactionHash };
    },
    onSuccess: result => {
      // Cancelled. Nothing changed, so nothing is invalidated and no success
      // is reported — a refetch here would re-render the row they just left.
      if (!result) return;

      void queryClient.invalidateQueries({ queryKey: [RAIN_RTF_QUERY_KEY] });

      track(TRACKING_EVENTS.CARD_RTF_APPROVE_COMPLETED, {
        chain_id: result.chainId,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to approve Real-Time Funding';
      setError(message);
      track(TRACKING_EVENTS.CARD_RTF_APPROVE_FAILED, {
        chain_id: chain?.chainId,
        error: message,
      });
    },
  });

  const approve = useCallback(
    async (termsVersion: string) => {
      setError(undefined);
      track(TRACKING_EVENTS.CARD_RTF_APPROVE_STARTED, {
        chain_id: chain?.chainId,
        spender_count: chain?.spenders.filter(spender => !spender.isApproved).length ?? 0,
      });
      // `mutateAsync` so the modal can close on success and stay open on
      // failure, with the error in place. `mutate` would resolve immediately
      // and leave both outcomes looking identical to the caller.
      const result = await approveMutation.mutateAsync(termsVersion).catch(() => null);
      return Boolean(result);
    },
    [approveMutation, chain],
  );

  return {
    shouldOffer: shouldOfferRtf({ isRainCard, status }),
    status,
    chain,
    isLoading: Boolean(user?.userId) && isRainCard && isLoading,
    isApproving: approveMutation.isPending,
    error,
    clearError: useCallback(() => setError(undefined), []),
    approve,
  };
};

export default useRainRealTimeFunding;
