import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import {
  AgentApiKeySummary,
  AgentSummary,
  GenerateAgentApiKeyResponse,
  fetchAgent,
  fetchAgentApiKeys,
  generateAgentApiKey,
  provisionAgent,
  revokeAgentApiKey,
  updateAgent,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const AGENT_QUERY_KEY = ['agent'] as const;
const AGENT_API_KEYS_QUERY_KEY = ['agent', 'api-keys'] as const;

export const useAgentQuery = () =>
  useQuery<AgentSummary>({
    queryKey: AGENT_QUERY_KEY,
    queryFn: () => withRefreshToken(() => fetchAgent()),
    staleTime: 60 * 1000,
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

export const useUpdateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { dailyCapUsdc?: number; recipientAllowlist?: string[] }) =>
      withRefreshToken(() => updateAgent(data)),
    onSuccess: updated => {
      queryClient.setQueryData(AGENT_QUERY_KEY, updated);
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
