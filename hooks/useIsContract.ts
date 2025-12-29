import { useQuery } from '@tanstack/react-query';
import { getBytecode } from '@wagmi/core';
import { Address } from 'viem';

import { config } from '@/lib/wagmi';

interface UseIsContractParams {
  address: Address | string | undefined;
  chainId: number | undefined;
  enabled?: boolean;
}

interface UseIsContract {
  isContract: boolean;
  isLoading: boolean;
}

export function useIsContract({
  address,
  chainId,
  enabled = true,
}: UseIsContractParams): UseIsContract {
  const { data: bytecode, isLoading } = useQuery({
    queryKey: ['isContract', address, chainId],
    queryFn: async () => {
      if (!address || !chainId) {
        return null;
      }

      const bytecode = await getBytecode(config, {
        address: address as Address,
        chainId,
      });

      return bytecode ?? null;
    },
    enabled: enabled && !!address && !!chainId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  const isContract =
    bytecode !== undefined && bytecode !== null && bytecode !== '0x' && bytecode.length > 2;

  return {
    isContract,
    isLoading,
  };
}
