import Toast from 'react-native-toast-message';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, type Chain, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidUsageBillingModule_ABI } from '@/lib/abis/SolidUsageBillingModule';
import { track } from '@/lib/analytics';
import {
  confirmAiApiBilling,
  createAiApiKey,
  deleteAiApiKey,
  fetchAiApiOverview,
  retryAiApiBilling,
  updateAiApiKey,
} from '@/lib/api/ai-api';
import { showErrorToast } from '@/lib/errors';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

import type {
  AiApiMandateRequired,
  AiApiOverview,
  CreateAiApiKeyResponse,
} from '@/lib/types/ai-api';

/** The mandate is in micro-USD: dollars with 6 decimals, whichever token pays. */
const BILLING_DECIMALS = 6n;

/**
 * The chains the AI API's billing module can be on, by id. Base today. A chain
 * the app does not know is refused rather than defaulted: signing a mandate on
 * the wrong chain would enable a module nobody bills through.
 */
const BILLING_CHAINS: Record<number, Chain> = { [base.id]: base };

export const aiApiQueryKey = (userId?: string) => ['ai-api', userId] as const;

/** The AI API dashboard: keys, this month's spend and cashback, billing state. */
export const useAiApiOverview = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  return useQuery<AiApiOverview>({
    queryKey: aiApiQueryKey(userId),
    queryFn: () => withRefreshToken(() => fetchAiApiOverview()),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000,
  });
};

const useInvalidateAiApi = () => {
  const queryClient = useQueryClient();
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  return () => queryClient.invalidateQueries({ queryKey: aiApiQueryKey(userId) });
};

/** A 409 from the API that says the Wallet mandate has to be signed first. */
const readMandateRequired = async (error: unknown): Promise<AiApiMandateRequired | null> => {
  if (!(error instanceof Response) || error.status !== 409) return null;
  try {
    const body = (await error.clone().json()) as Partial<AiApiMandateRequired>;
    return body?.code === 'mandate_required' ? (body as AiApiMandateRequired) : null;
  } catch {
    return null;
  }
};

/**
 * Let Solid charge the Wallet for AI API usage, up to a daily amount.
 *
 * One user operation, like a tier membership: enable the AI API's billing
 * module on the Safe, then write the mandate. Batching them means a Safe can
 * never end up with the module enabled and nothing bounding it.
 *
 * The mandate is exactly what the keys could spend in a day — every key's
 * monthly limit together, since one key can spend its whole limit at once. A
 * cap with headroom would survive a raise without asking, and asking is the
 * point: more spending power is a new agreement the user should sign.
 *
 * @returns false when the user dismissed the passkey prompt.
 */
export const useAllowAiApiCharges = () => {
  const { user, safeAA } = useUser();
  const invalidate = useInvalidateAiApi();

  const mutation = useMutation({
    mutationFn: async ({
      requiredMandateUsd,
      moduleAddress,
      moduleEnabled,
      periodSeconds,
      chainId,
    }: {
      requiredMandateUsd: number;
      moduleAddress: string;
      moduleEnabled: boolean;
      periodSeconds: number;
      chainId: number;
    }) => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      const chain = BILLING_CHAINS[chainId];
      if (!chain) throw new Error('This app version can’t set up AI API billing. Please update.');

      const mandate = BigInt(Math.ceil(requiredMandateUsd)) * 10n ** BILLING_DECIMALS;
      if (mandate <= 0n) throw new Error('Nothing to allow yet.');

      const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          ...(moduleEnabled
            ? []
            : [
                {
                  to: user.safeAddress as Address,
                  data: encodeFunctionData({
                    abi: Safe_ABI,
                    functionName: 'enableModule',
                    args: [moduleAddress as Address],
                  }),
                  value: 0n,
                },
              ]),
          {
            to: moduleAddress as Address,
            data: encodeFunctionData({
              abi: SolidUsageBillingModule_ABI,
              functionName: 'subscribe',
              args: [mandate, BigInt(periodSeconds)],
            }),
            value: 0n,
          },
        ],
        'Failed to allow AI API charges',
        chain,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.AI_API_MANDATE_CANCELLED, {
          required_mandate_usd: requiredMandateUsd,
        });
        return false;
      }

      // Told afterwards, not before: the backend reads the mandate back from
      // the chain, and a paused account has its waiting charge tried at once.
      await withRefreshToken(() =>
        confirmAiApiBilling({ transactionHash: result.transactionHash }),
      );
      track(TRACKING_EVENTS.AI_API_MANDATE_SIGNED, {
        required_mandate_usd: requiredMandateUsd,
        transaction_hash: result.transactionHash,
      });
      return true;
    },
    // No error UI of its own: it runs inside key creation and limit changes,
    // whose own error handling reports it, and a second toast for the same
    // failure would only be noise. Direct callers show theirs.
    onSuccess: () => invalidate(),
  });

  return { allow: mutation.mutateAsync, isAllowing: mutation.isPending };
};

/**
 * Create a key. When the Wallet mandate does not cover it yet, the API says so
 * and the user is asked to sign first; the key is created once they have.
 *
 * @returns the new key with its secret, or null when the user dismissed the
 * passkey prompt.
 */
export const useCreateAiApiKey = () => {
  const invalidate = useInvalidateAiApi();
  const { allow, isAllowing } = useAllowAiApiCharges();

  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      monthlyLimitUsd: number;
    }): Promise<CreateAiApiKeyResponse | null> => {
      try {
        return await withRefreshToken(() => createAiApiKey(input));
      } catch (error) {
        const required = await readMandateRequired(error);
        if (!required?.moduleAddress) throw error;

        const signed = await allow({
          requiredMandateUsd: required.requiredMandateUsd,
          moduleAddress: required.moduleAddress,
          moduleEnabled: required.moduleEnabled,
          periodSeconds: required.periodSeconds,
          chainId: required.chainId,
        });
        if (!signed) return null;

        return withRefreshToken(() => createAiApiKey(input));
      }
    },
    onSuccess: result => {
      if (!result) return;
      invalidate();
      track(TRACKING_EVENTS.AI_API_KEY_CREATED, {
        monthly_limit_usd: result.key.monthlyLimitUsd,
      });
    },
    onError: error => {
      track(TRACKING_EVENTS.AI_API_KEY_CREATE_FAILED, {
        status: error instanceof Response ? error.status : undefined,
      });
      void showErrorToast(error, { action: 'ai_api', title: 'Couldn’t create your key' });
    },
  });

  return {
    createKey: mutation.mutateAsync,
    isCreating: mutation.isPending || isAllowing,
  };
};

/** Rename a key or change its monthly limit, signing a bigger mandate first if a raise needs one. */
export const useUpdateAiApiKey = () => {
  const invalidate = useInvalidateAiApi();
  const { allow, isAllowing } = useAllowAiApiCharges();

  const mutation = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      monthlyLimitUsd?: number;
    }) => {
      try {
        return await withRefreshToken(() => updateAiApiKey(id, input));
      } catch (error) {
        const required = await readMandateRequired(error);
        if (!required?.moduleAddress) throw error;

        const signed = await allow({
          requiredMandateUsd: required.requiredMandateUsd,
          moduleAddress: required.moduleAddress,
          moduleEnabled: required.moduleEnabled,
          periodSeconds: required.periodSeconds,
          chainId: required.chainId,
        });
        if (!signed) return null;

        return withRefreshToken(() => updateAiApiKey(id, input));
      }
    },
    onSuccess: (key, input) => {
      if (!key) return;
      invalidate();
      if (input.monthlyLimitUsd !== undefined) {
        track(TRACKING_EVENTS.AI_API_KEY_LIMIT_CHANGED, {
          monthly_limit_usd: input.monthlyLimitUsd,
        });
      }
      if (input.name !== undefined) track(TRACKING_EVENTS.AI_API_KEY_RENAMED);
    },
    onError: error => {
      void showErrorToast(error, { action: 'ai_api', title: 'Couldn’t update your key' });
    },
  });

  return {
    updateKey: mutation.mutateAsync,
    isUpdating: mutation.isPending || isAllowing,
  };
};

export const useDeleteAiApiKey = () => {
  const invalidate = useInvalidateAiApi();
  return useMutation({
    mutationFn: (id: string) => withRefreshToken(() => deleteAiApiKey(id)),
    onSuccess: () => {
      invalidate();
      track(TRACKING_EVENTS.AI_API_KEY_DELETED);
      Toast.show({ type: 'success', text1: 'Key deleted' });
    },
    onError: error => {
      void showErrorToast(error, { action: 'ai_api', title: 'Couldn’t delete your key' });
    },
  });
};

/** Try the waiting charge now — the "added funds, start my agents" path. */
export const useRetryAiApiBilling = () => {
  const invalidate = useInvalidateAiApi();
  return useMutation({
    mutationFn: () => withRefreshToken(() => retryAiApiBilling()),
    onSuccess: () => invalidate(),
  });
};
