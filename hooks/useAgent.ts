import Toast from 'react-native-toast-message';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, erc20Abi } from 'viem';
import { base } from 'viem/chains';

import {
  fetchAgent,
  fetchAgentApiKeys,
  fetchAgentHasDeposited,
  generateAgentApiKey,
  provisionAgent,
  revokeAgentApiKey,
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

export const useProvisionAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => withRefreshToken(() => provisionAgent()),
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
    onError: () => {
      Toast.show({
        type: 'error',
        text1: 'Failed to provision agent',
        props: { badgeText: 'Error' },
      });
    },
  });
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
