import Toast from 'react-native-toast-message';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { Address, erc20Abi } from 'viem';
import { base } from 'viem/chains';

import {
  fetchAgent,
  fetchAgentApiKeys,
  fetchAgentHasDeposited,
  generateAgentApiKey,
  provisionAgentInit,
  provisionAgentPolicy,
  provisionAgentUser,
  provisionAgentWalletAccount,
  revokeAgentApiKey,
  type SignedTurnkeyRequest,
} from '@/lib/api';
import { AgentApiKeySummary, AgentSummary, GenerateAgentApiKeyResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { getStargateToken } from '@/lib/utils/stargate';
import { publicClient } from '@/lib/wagmi';

const AGENT_QUERY_KEY = ['agent'] as const;
const AGENT_API_KEYS_QUERY_KEY = ['agent', 'api-keys'] as const;
const AGENT_BALANCE_QUERY_KEY = (address?: string) =>
  ['agent', 'balance', address?.toLowerCase()] as const;
const AGENT_DEPOSITED_QUERY_KEY = ['agent', 'has-deposited'] as const;

// Reuse the canonical Base USDC mapping the Stargate bridge already
// maintains — keeps both feature surfaces in sync if it ever changes.
const BASE_USDC_ADDRESS = getStargateToken(base.id) as Address | null;

export const useAgentQuery = () =>
  useQuery<AgentSummary>({
    queryKey: AGENT_QUERY_KEY,
    queryFn: () => withRefreshToken(() => fetchAgent()),
    staleTime: 60 * 1000,
  });

/**
 * On-chain USDC balance for the agent EOA on Base. 6-decimal raw bigint.
 * Mirrors the polling cadence and resilience options of useBalances for the
 * Safe wallet (hooks/useBalances.ts).
 */
export const useAgentBalance = (agentEoaAddress?: string) =>
  useQuery<bigint>({
    queryKey: AGENT_BALANCE_QUERY_KEY(agentEoaAddress),
    enabled: !!agentEoaAddress && !!BASE_USDC_ADDRESS,
    queryFn: async () => {
      const client = publicClient(base.id);
      return client.readContract({
        address: BASE_USDC_ADDRESS as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [agentEoaAddress as Address],
      });
    },
    staleTime: 5_000,
    gcTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

/**
 * Whether the agent has ever received a successful deposit. Derived from
 * the activity feed and cached for an hour — a one-way transition, so we
 * can be aggressive about staleness.
 */
export const useAgentDeposited = (enabled: boolean) =>
  useQuery<boolean>({
    queryKey: AGENT_DEPOSITED_QUERY_KEY,
    enabled,
    queryFn: () => withRefreshToken(() => fetchAgentHasDeposited()),
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

/**
 * Drives the four-step session-stamped provisioning flow:
 *   init → walletAccount → user → policy
 *
 * Each step's body is built by the backend; the user's Turnkey session API
 * key signs them via `httpClient.stampX(body, StamperType.ApiKey)`. We mint
 * (or refresh) the session up front with one passkey gesture, then every
 * subsequent stamp is silent.
 */
export const useProvisionAgent = () => {
  const queryClient = useQueryClient();
  const { httpClient, loginWithPasskey, refreshSession, getSession } = useTurnkey();

  return useMutation({
    mutationFn: async () => {
      // 1. Backend mints the provisioning record + first activity body.
      const { provisioningId, activity: walletAcctActivity } = await withRefreshToken(() =>
        provisionAgentInit(),
      );

      // 2. Establish a Turnkey read-write session — one passkey gesture if
      //    we don't already have a live session with enough headroom.
      await ensureSession({ getSession, refreshSession, loginWithPasskey });

      if (!httpClient) {
        throw new Error('Turnkey httpClient is not initialized');
      }

      // 3. Stamp + relay createWalletAccounts (silent; uses session API key).
      const signed1 = await httpClient.stampCreateWalletAccounts(
        walletAcctActivity.body as Parameters<typeof httpClient.stampCreateWalletAccounts>[0],
        StamperType.ApiKey,
      );
      if (!signed1) throw new Error('Failed to stamp createWalletAccounts');
      const { activity: usersActivity } = await provisionAgentWalletAccount({
        provisioningId,
        signed: signed1 as SignedTurnkeyRequest,
      });

      // 4. Stamp + relay createUsers.
      const signed2 = await httpClient.stampCreateUsers(
        usersActivity.body as Parameters<typeof httpClient.stampCreateUsers>[0],
        StamperType.ApiKey,
      );
      if (!signed2) throw new Error('Failed to stamp createUsers');
      const { activity: policyActivity } = await provisionAgentUser({
        provisioningId,
        signed: signed2 as SignedTurnkeyRequest,
      });

      // 5. Stamp + relay createPolicy. Backend has now baked
      //    agentTurnkeyUserId into the CEL.
      const signed3 = await httpClient.stampCreatePolicy(
        policyActivity.body as Parameters<typeof httpClient.stampCreatePolicy>[0],
        StamperType.ApiKey,
      );
      if (!signed3) throw new Error('Failed to stamp createPolicy');
      return provisionAgentPolicy({
        provisioningId,
        signed: signed3 as SignedTurnkeyRequest,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      Toast.show({
        type: 'success',
        text1: 'Agent provisioned',
        text2: 'Deposit USD to start using your agent',
        props: { badgeText: 'Success' },
      });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : undefined;
      Toast.show({
        type: 'error',
        text1: 'Failed to provision agent',
        text2: message?.toLowerCase().includes('cancel')
          ? 'Passkey prompt was cancelled'
          : undefined,
        props: { badgeText: 'Error' },
      });
    },
  });
};

const SESSION_HEADROOM_SECONDS = 60;

const ensureSession = async (deps: {
  getSession: ReturnType<typeof useTurnkey>['getSession'];
  refreshSession: ReturnType<typeof useTurnkey>['refreshSession'];
  loginWithPasskey: ReturnType<typeof useTurnkey>['loginWithPasskey'];
}) => {
  const existing = await deps.getSession();
  const nowSeconds = Date.now() / 1000;
  if (existing && existing.expiry > nowSeconds + SESSION_HEADROOM_SECONDS) {
    try {
      await deps.refreshSession({ expirationSeconds: '900' });
      return;
    } catch {
      // Fall through to a fresh passkey login.
    }
  }
  await deps.loginWithPasskey({ expirationSeconds: '900' });
};

export const useAgentApiKeys = () =>
  useQuery<AgentApiKeySummary[]>({
    queryKey: AGENT_API_KEYS_QUERY_KEY,
    queryFn: () => withRefreshToken(() => fetchAgentApiKeys()),
    staleTime: 30 * 1000,
  });

export const useGenerateAgentApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation<GenerateAgentApiKeyResponse, unknown, string | undefined>({
    mutationFn: (name?: string) => withRefreshToken(() => generateAgentApiKey(name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_API_KEYS_QUERY_KEY });
    },
  });
};

export const useRevokeAgentApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => withRefreshToken(() => revokeAgentApiKey(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_API_KEYS_QUERY_KEY });
      Toast.show({
        type: 'success',
        text1: 'API key revoked',
        props: { badgeText: 'Success' },
      });
    },
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to revoke API key',
        props: { badgeText: 'Error' },
      });
    },
  });
};
