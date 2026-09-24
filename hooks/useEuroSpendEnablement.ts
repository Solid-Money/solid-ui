import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData } from 'viem';

import {
  BASE_SPEND_DEPLOYMENT,
  isSpendDeploymentConfigured,
} from '@/constants/spendModuleDeployments';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { track } from '@/lib/analytics';
import { confirmCardSpendDeployment, getCardSpendDeployments } from '@/lib/api';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardSpendDeployment } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

export const CARD_SPEND_DEPLOYMENTS_QUERY_KEY = 'cardSpendDeployments';

/** How long the deployment list is trusted before it is asked again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * Register with the deployment's own default caps.
 *
 * `registerSafe` applies the module's configured defaults when passed zero, so passing zero is
 * what asks for them. Deliberately not carried over from the user's Fuse caps: the two instances
 * police separate windows, and copying a number across would present one limit to a user who
 * actually has two — which is a promise this client is in no position to keep.
 */
const DEFAULT_LIMITS = 0n;

/**
 * How many times the confirm is retried, and how long between attempts.
 *
 * The enable transaction and the backend's verifying read go to different nodes, so the read can
 * land before the block carrying the enablement has propagated. The backend answers 503 in that
 * case and records nothing — and without a retry here that is a user who enabled euro spending
 * on-chain, paid the gas, and has no record of it anywhere that routing can see.
 *
 * Bounded rather than indefinite: if it has not propagated within this window something is
 * genuinely wrong, and the user is better told so than left watching a spinner. Re-pressing enable
 * recovers from there, since both on-chain halves are already done and the hook goes straight back
 * to the confirm.
 */
const CONFIRM_RETRIES = 4;
const CONFIRM_RETRY_DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Confirms the enablement, retrying while the backend reports it cannot yet see it on-chain.
 *
 * Only 503 is retried. A 400 means the request itself is wrong — an unknown chain, or a module
 * address this backend does not operate — and repeating it would just be slower.
 */
const confirmWithRetry = async (
  chainId: number,
  body: Parameters<typeof confirmCardSpendDeployment>[1],
) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await confirmCardSpendDeployment(chainId, body);
    } catch (error) {
      const status = (error as Response)?.status;
      if (status !== 503 || attempt >= CONFIRM_RETRIES) throw error;
      await sleep(CONFIRM_RETRY_DELAY_MS);
    }
  }
};

/**
 * Seconds from UTC this device's day boundary sits at, for the rolling spend windows.
 *
 * Negated because `getTimezoneOffset` reports minutes to ADD to local time to reach UTC, and the
 * module wants the offset FROM UTC. Getting the sign wrong moves a user's daily reset by twice
 * their offset, which is silent and only shows up as a limit resetting at the wrong hour.
 */
const deviceTimezoneOffsetSeconds = () => -new Date().getTimezoneOffset() * 60;

interface EuroSpendEnablement {
  /**
   * Whether to render the enable card.
   *
   * True only when every one of these holds: the user is in the rollout cohort, the backend has a
   * working Base deployment configured, this build has the addresses to execute against, and the
   * backend has no record of this user already enabling it.
   */
  shouldOffer: boolean;
  /** The Base deployment as the backend describes it, once it has answered. */
  deployment: CardSpendDeployment | undefined;
  /** Already enabled, per our durable record. */
  isEnabled: boolean;
  isLoading: boolean;
  isEnabling: boolean;
  error: string | undefined;
  clearError: () => void;
  enable: () => void;
}

/**
 * The "enable euro spending on Base" flow, end to end.
 *
 * ## What enabling actually is
 *
 * Two calls in one user operation, on Base: `enableModule` on the user's Safe, which is the
 * owner-signed consent that lets the module move funds at all, and `registerSafe` on the module,
 * which opens the Safe's spend record and its limit windows. They are batched because a Safe with
 * the module enabled but unregistered declines every transaction, and so does the reverse — a
 * half-finished enablement is a card that looks set up and is not.
 *
 * Each call is skipped if the chain says it is already done. Both revert on a repeat
 * (`registerSafe` reverts `AlreadyRegistered` and there is no deregister), and a revert fails the
 * whole batch — so a user retrying after a partial success would be permanently stuck without this.
 *
 * ## Why the gate is the backend's record and not a chain read
 *
 * `shouldOffer` comes from `spend-deployments`, which the backend serves from Mongo. A chain read
 * here would mean a slow or failing Base RPC shows the enable card to someone who already enabled
 * it, and hands them a transaction that reverts. The chain is still authoritative for what the
 * transaction does — it is read below, immediately before the batch is built, and again by the
 * backend before it records anything.
 *
 * ## Note on the name
 *
 * The Base instance is **dollar-denominated**; EURC is a spendable asset within it and is
 * explicitly not collateral at launch, so nothing here lends against euros. The copy this powers
 * says "euro", which is what the user experiences — spending a euro balance — and is fine as long
 * as nobody reads the code and concludes there is a euro credit line.
 */
export const useEuroSpendEnablement = (): EuroSpendEnablement => {
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();

  const { data, isLoading } = useQuery({
    queryKey: [CARD_SPEND_DEPLOYMENTS_QUERY_KEY, user?.userId],
    queryFn: getCardSpendDeployments,
    enabled: !!user?.userId,
    staleTime: STALE_MS,
    // A gate that retries forever keeps the card hidden for the same length of time either way;
    // one retry covers a transient blip without holding the query pending.
    retry: 1,
  });

  const deployment = data?.deployments.find(d => d.chainId === BASE_SPEND_DEPLOYMENT.chainId);

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      if (!isSpendDeploymentConfigured(BASE_SPEND_DEPLOYMENT)) {
        throw new Error('Euro spending is not available in this version of the app.');
      }

      // The backend's address wins over the build's. The app can be weeks behind a redeploy, and
      // enabling a module the backend does not operate produces a Safe that consents to a contract
      // nothing will ever debit — a silent failure the user has no way to see.
      const moduleAddress = (deployment?.moduleAddress ??
        BASE_SPEND_DEPLOYMENT.moduleAddress) as Address;
      const safeAddress = (deployment?.safeAddress ?? user.safeAddress) as Address;

      // Read the chain immediately before building the batch, so a partially completed enablement
      // — one call landed, the other reverted or was abandoned — resumes rather than reverting on
      // the half that is already done.
      //
      // ## Read the MODULE, not the lens
      //
      // `SolidSpendLens.availableToSpendWith` is the obvious call and it does not work here.
      // `cohortOf` short-circuits on a Safe already live on v2 and otherwise falls through to
      // `v1.isRegistered(safe)` — and on Base the v1 sentinel is the burn address, which has no
      // code, so that call reverts. Every Safe that is not already registered therefore reverts,
      // which is precisely every Safe arriving at this screen. Verified against the deployed
      // contracts: the Base lens reverts for an unregistered Safe where the Fuse lens returns
      // clean zeros.
      //
      // The module answers both facts directly and has code, so it is both correct and cheaper.
      // They are separate reads because they are separate facts: registration is permanent
      // (`registerSafe` reverts `AlreadyRegistered` and there is no deregister) while module
      // consent can be withdrawn at any time, so a Safe can be registered with the module off.
      const [moduleEnabled, registered] = await Promise.all([
        publicClient(BASE_SPEND_DEPLOYMENT.chainId).readContract({
          address: moduleAddress,
          abi: SolidCashModuleV2_ABI,
          functionName: 'isModuleEnabledOn',
          args: [safeAddress],
        }),
        publicClient(BASE_SPEND_DEPLOYMENT.chainId).readContract({
          address: moduleAddress,
          abi: SolidCashModuleV2_ABI,
          functionName: 'isRegistered',
          args: [safeAddress],
        }),
      ]);

      const state = { moduleEnabled, registered };

      const transactions = [
        ...(state.moduleEnabled
          ? []
          : [
              {
                to: safeAddress,
                data: encodeFunctionData({
                  abi: Safe_ABI,
                  functionName: 'enableModule',
                  args: [moduleAddress],
                }),
              },
            ]),
        ...(state.registered
          ? []
          : [
              {
                to: moduleAddress,
                data: encodeFunctionData({
                  abi: SolidCashModuleV2_ABI,
                  functionName: 'registerSafe',
                  args: [DEFAULT_LIMITS, DEFAULT_LIMITS, BigInt(deviceTimezoneOffsetSeconds())],
                }),
              },
            ]),
      ];

      // Both halves already done on-chain while our record says otherwise — the confirm call after
      // a previous attempt never landed, most likely. Recording it is exactly the fix, so this
      // falls through to `confirmCardSpendDeployment` rather than raising at the user.
      if (transactions.length > 0) {
        const smartAccountClient = await safeAA(
          BASE_SPEND_DEPLOYMENT.chain,
          user.suborgId,
          user.signWith,
        );

        const result = await executeTransactions(
          smartAccountClient,
          transactions,
          'Failed to enable euro spending',
          BASE_SPEND_DEPLOYMENT.chain,
        );

        if (result === USER_CANCELLED_TRANSACTION) {
          track(TRACKING_EVENTS.CARD_EURO_SPEND_ENABLE_CANCELLED, {
            chain_id: BASE_SPEND_DEPLOYMENT.chainId,
          });
          return null;
        }

        await confirmWithRetry(BASE_SPEND_DEPLOYMENT.chainId, {
          transactionHash: result.transactionHash,
          moduleAddress,
        });

        return { transactionHash: result.transactionHash };
      }

      await confirmWithRetry(BASE_SPEND_DEPLOYMENT.chainId, { moduleAddress });

      return { transactionHash: undefined };
    },
    onSuccess: result => {
      // Cancelled by the user. Nothing changed, so nothing is invalidated and no success is
      // reported — a refetch here would only re-render the same card they just dismissed.
      if (!result) return;

      void queryClient.invalidateQueries({
        queryKey: [CARD_SPEND_DEPLOYMENTS_QUERY_KEY],
      });

      track(TRACKING_EVENTS.CARD_EURO_SPEND_ENABLE_COMPLETED, {
        chain_id: BASE_SPEND_DEPLOYMENT.chainId,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to enable euro spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_EURO_SPEND_ENABLE_FAILED, { error: message });
    },
  });

  const enable = useCallback(() => {
    setError(undefined);
    track(TRACKING_EVENTS.CARD_EURO_SPEND_ENABLE_STARTED, {
      chain_id: BASE_SPEND_DEPLOYMENT.chainId,
    });
    enableMutation.mutate();
  }, [enableMutation]);

  return {
    shouldOffer: Boolean(
      data?.cohortEnabled &&
      deployment?.available &&
      !deployment?.enabled &&
      isSpendDeploymentConfigured(BASE_SPEND_DEPLOYMENT),
    ),
    deployment,
    isEnabled: deployment?.enabled === true,
    isLoading: !!user?.userId && isLoading,
    isEnabling: enableMutation.isPending,
    error,
    clearError: useCallback(() => setError(undefined), []),
    enable,
  };
};

export default useEuroSpendEnablement;
