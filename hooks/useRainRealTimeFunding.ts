import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { confirmRainRtf, getRainRtfStatus } from '@/lib/api';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider, RainRtfChain, RainRtfStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import {
  buildApprovalBatch,
  describeApprovalWork,
  selectRtfChains,
  shouldOfferRtf,
} from '@/lib/utils/realTimeFunding';
import { getChain } from '@/lib/wagmi';

export const RAIN_RTF_QUERY_KEY = 'rainRealTimeFunding';

/** How long the status is trusted before it is asked again. */
const STALE_MS = 60 * 1000;

/** Which chain the flow is on, for the progress line while it walks them. */
export interface RainRtfApprovalProgress {
  /** 1-based, for "Network 2 of 3". */
  step: number;
  total: number;
  chainName: string;
}

interface RainRealTimeFunding {
  /**
   * Whether to render the "Real-Time Funding" row on the card screen.
   *
   * True only when every one of these holds: the card is a Rain card, Rain has
   * enabled RTF for the tenant, this cardholder is eligible, and at least one
   * chain is still missing a healthy allowance. It goes false the moment the
   * approvals land, which is the point — the row is a task, not a setting.
   */
  shouldOffer: boolean;
  /** The full status, once the backend has answered. */
  status: RainRtfStatus | undefined;
  /**
   * The chain the flow starts on — the first still owing approvals.
   *
   * Not a picker. A cardholder has no basis for choosing between chains, and
   * "which network is my card on" is not a question to put to them. The flow
   * walks every chain that owes approvals in turn, starting here.
   */
  chain: RainRtfChain | undefined;
  /**
   * How much work the cardholder is agreeing to: how many allowances, and how
   * many times they will be asked to sign.
   *
   * The two differ, and both are shown. Everything on one chain batches into
   * one signature; chains cannot batch with each other at all.
   */
  work: {
    approvals: number;
    signatures: number;
    chainNames: string[];
    assetSymbols: string[];
  };
  /** Which chain is being signed right now, while `isApproving`. */
  progress: RainRtfApprovalProgress | undefined;
  isLoading: boolean;
  isApproving: boolean;
  error: string | undefined;
  clearError: () => void;
  /**
   * Grant every outstanding allowance and record the consent.
   *
   * Resolves `true` when every chain is authorized, `false` when the
   * cardholder dismissed a signature prompt — a dismissal is not a failure
   * and must not be reported as one. Throws nothing; failures land in
   * {@link error}.
   */
  approve: (termsVersion: string) => Promise<boolean>;
}

/**
 * Rain Real-Time Funding, end to end.
 *
 * ## What approving actually is
 *
 * One ERC-20 `approve` per (token, spender) pair, from the cardholder's Safe,
 * each for `uint256` max.
 *
 * The count is a product, not a constant, and that is the thing worth being
 * precise about. An allowance is scoped to exactly one (token, owner,
 * spender) triple — there is no approving "a wallet" or "a chain" — so a
 * cardholder owes `assets × spenders` approvals on every chain Rain holds a
 * collateral contract for. Today that is two per chain (one asset, two
 * spenders mid-migration) and it grows as Rain adds assets during the beta.
 *
 * There are two spenders because Rain is migrating to reversal-enabled
 * collateral contracts, and approving both is deliberate rather than
 * belt-and-braces:
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
 * The backend decides which assets and spenders to send; this hook never
 * invents one.
 *
 * ## What batches, and what cannot
 *
 * **Within a chain, everything batches.** Every outstanding `approve` on one
 * chain goes into a single user operation: same chain, same smart account, so
 * the account signs once and the bundler submits once. Four approvals and one
 * signature, not four of each.
 *
 * **Across chains, nothing can.** A user operation is executed by one chain's
 * EntryPoint against one account; there is no cross-chain user operation to
 * batch into, and no amount of client work changes that. So the floor is one
 * signature per chain, and the flow walks the chains in turn rather than
 * pretending otherwise — one consent, one pass, a progress line naming which
 * network is being signed. The alternative, which this replaces, was making
 * the cardholder reopen the modal and re-read the terms once per chain.
 *
 * A chain that fails stops the walk and reports. The chains already done keep
 * their recorded authorizations — each confirm lands per chain — so pressing
 * Approve again resumes at the one that failed rather than re-approving what
 * already succeeded.
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
  const [progress, setProgress] = useState<RainRtfApprovalProgress>();

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

  // Selection, batching and the offer gate live in
  // `lib/utils/realTimeFunding` rather than here, so they are unit testable:
  // all three are load-bearing — one decides what gets approved, one builds
  // the calls, one decides whether the cardholder is ever asked — and this
  // hook's import graph does not load under jest-expo.
  const { chain, pendingChains } = useMemo(() => selectRtfChains(status), [status]);
  const work = useMemo(() => describeApprovalWork(status), [status]);

  const approveMutation = useMutation({
    mutationFn: async (termsVersion: string) => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      if (!status || pendingChains.length === 0) {
        throw new Error('Real-Time Funding is not available for this card right now.');
      }

      const authorized: number[] = [];

      // Sequential, not `Promise.all`. Each chain is its own signature prompt
      // and a wallet presents one at a time; firing them together would stack
      // prompts the cardholder cannot make sense of, and a nonce race on the
      // same account would make some of them fail for no visible reason.
      for (const [index, target] of pendingChains.entries()) {
        setProgress({
          step: index + 1,
          total: pendingChains.length,
          chainName: target.name,
        });

        const viemChain = getChain(target.chainId);
        if (!viemChain) {
          // A chain the backend offers that this build cannot address. Rain
          // adds chains during the beta and the app can be weeks behind, so
          // this is a normal state to reach — and it has to fail loudly
          // rather than fall back to another chain, which would approve the
          // wrong token on the wrong network and look like success.
          throw new Error(
            `${target.name} isn’t supported by this version of the app. Please update and try again.`,
          );
        }

        // Every outstanding (token, spender) approval on this chain, as one
        // batch. Pairs already at a healthy allowance are left out, so a
        // partially-landed earlier attempt resumes rather than paying twice.
        const transactions = buildApprovalBatch({
          chain: target,
          maxAllowance: status.maxAllowance,
        });

        let transactionHash: string | undefined;

        // Nothing left to send while the status said otherwise — the confirm
        // after an earlier attempt never landed, most likely. Recording it is
        // exactly the fix, so this falls through to the confirm rather than
        // raising at a cardholder whose wallet is already correct.
        if (transactions.length > 0) {
          const smartAccountClient = await safeAA(viemChain, user.suborgId, user.signWith);

          const result = await executeTransactions(
            smartAccountClient,
            transactions,
            `Failed to approve Real-Time Funding on ${target.name}`,
            viemChain,
          );

          if (result === USER_CANCELLED_TRANSACTION) {
            track(TRACKING_EVENTS.CARD_RTF_APPROVE_CANCELLED, {
              chain_id: target.chainId,
              chain_index: index,
              chains_total: pendingChains.length,
            });
            // Stop the walk. The chains already authorized keep their
            // records, so pressing Approve again resumes here instead of
            // starting over.
            return authorized.length > 0
              ? { chainIds: authorized, requested: pendingChains.length }
              : null;
          }

          transactionHash = result.transactionHash;
        }

        // The consent is the half of this the chain cannot hold, and it is
        // recorded per chain — so a walk that stops halfway leaves an
        // accurate record of exactly the chains that were authorized.
        await withRefreshToken(() =>
          confirmRainRtf({
            chainId: target.chainId,
            termsAccepted: true,
            termsVersion,
            ...(transactionHash ? { transactionHash } : {}),
          }),
        );

        authorized.push(target.chainId);
      }

      return { chainIds: authorized, requested: pendingChains.length };
    },
    onSettled: () => setProgress(undefined),
    onSuccess: result => {
      // Cancelled before anything landed. Nothing changed, so nothing is
      // invalidated and no success is reported — a refetch here would
      // re-render the row they just left.
      if (!result) return;

      void queryClient.invalidateQueries({ queryKey: [RAIN_RTF_QUERY_KEY] });

      // `requested` alongside `authorized` so the funnel can tell a complete
      // pass from one the cardholder abandoned partway. They differ whenever
      // a signature prompt was dismissed on the second or third network, and
      // a count on its own would make those look like successes.
      track(TRACKING_EVENTS.CARD_RTF_APPROVE_COMPLETED, {
        chain_ids: result.chainIds,
        chains_authorized: result.chainIds.length,
        chains_requested: result.requested,
        is_complete: result.chainIds.length === result.requested,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to approve Real-Time Funding';
      setError(message);
      // Whatever landed before the failure is real and recorded, so the
      // status is refetched either way — otherwise the retry would rebuild a
      // batch for approvals that already succeeded.
      void queryClient.invalidateQueries({ queryKey: [RAIN_RTF_QUERY_KEY] });
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
        approval_count: work.approvals,
        signature_count: work.signatures,
      });
      // `mutateAsync` so the modal can close on success and stay open on
      // failure, with the error in place. `mutate` would resolve immediately
      // and leave both outcomes looking identical to the caller.
      const result = await approveMutation.mutateAsync(termsVersion).catch(() => null);
      // Every chain, not merely some: a partial walk leaves the row up with
      // the ones that are left, which is the honest state.
      return Boolean(result && result.chainIds.length === result.requested);
    },
    [approveMutation, chain, work.approvals, work.signatures],
  );

  return {
    shouldOffer: shouldOfferRtf({ isRainCard, status }),
    status,
    chain,
    work,
    progress,
    isLoading: Boolean(user?.userId) && isRainCard && isLoading,
    isApproving: approveMutation.isPending,
    error,
    clearError: useCallback(() => setError(undefined), []),
    approve,
  };
};

export default useRainRealTimeFunding;
