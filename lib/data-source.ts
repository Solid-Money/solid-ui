import axios from 'axios';
import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { isAlchemyChain } from '@/constants/alchemy';
import { explorerUrls } from '@/constants/explorers';
import { fetchAlchemyTokenBalances, fetchAlchemyTokenTransfers } from '@/lib/alchemy';
import { BlockscoutTransactions } from '@/lib/types';

import type { BlockscoutTokenBalance } from '@/hooks/useBalances';

/**
 * Dispatcher: tries Alchemy first, falls back to Blockscout on failure.
 * Fuse (122) is always Blockscout (not supported by Alchemy).
 */

const BLOCKSCOUT_URLS: Record<number, string> = {
  [mainnet.id]: 'https://eth.blockscout.com',
  [base.id]: 'https://base.blockscout.com',
  [polygon.id]: 'https://polygon.blockscout.com',
  [arbitrum.id]: 'https://arbitrum.blockscout.com',
  [fuse.id]: explorerUrls[fuse.id]?.blockscout ?? 'https://explorer.fuse.io',
};

const blockscoutUrlForChain = (chainId: number): string | undefined => BLOCKSCOUT_URLS[chainId];

const fetchBlockscoutTokenBalances = async (
  chainId: number,
  address: string,
): Promise<BlockscoutTokenBalance[]> => {
  const url = blockscoutUrlForChain(chainId);
  if (!url) return [];
  const response = await fetch(`${url}/api/v2/addresses/${address}/token-balances`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Blockscout token-balances ${response.status} for chain ${chainId}`);
  }
  return (await response.json()) as BlockscoutTokenBalance[];
};

const fetchBlockscoutTokenTransfers = async ({
  chainId,
  address,
  token,
  filter = 'to',
  explorerUrl,
}: {
  chainId: number;
  address: string;
  token?: string;
  filter?: 'from' | 'to';
  explorerUrl?: string;
}): Promise<BlockscoutTransactions> => {
  const url = explorerUrl ?? blockscoutUrlForChain(chainId) ?? BLOCKSCOUT_URLS[fuse.id];
  const params: string[] = ['type=ERC-20'];
  if (filter) params.push(`filter=${filter}`);
  if (token) params.push(`token=${token}`);
  const response = await axios.get<BlockscoutTransactions>(
    `${url}/api/v2/addresses/${address}/token-transfers?${params.join('&')}`,
  );
  return response.data;
};

export const fetchTokenBalancesWithFallback = async (
  chainId: number,
  address: string,
): Promise<BlockscoutTokenBalance[]> => {
  if (!isAlchemyChain(chainId)) {
    return fetchBlockscoutTokenBalances(chainId, address);
  }
  try {
    return await fetchAlchemyTokenBalances(chainId, address);
  } catch (err) {
    console.warn(
      `[data-source] alchemy balances failed for chain ${chainId}, falling back to blockscout`,
      err,
    );
    return fetchBlockscoutTokenBalances(chainId, address);
  }
};

export const fetchTokenTransferWithFallback = async ({
  chainId,
  address,
  token,
  filter = 'to',
  blockscoutExplorerUrl,
}: {
  chainId: number;
  address: string;
  token?: string;
  filter?: 'from' | 'to';
  blockscoutExplorerUrl?: string;
}): Promise<BlockscoutTransactions> => {
  if (!isAlchemyChain(chainId)) {
    return fetchBlockscoutTokenTransfers({
      chainId,
      address,
      token,
      filter,
      explorerUrl: blockscoutExplorerUrl,
    });
  }
  try {
    return await fetchAlchemyTokenTransfers({ chainId, address, token, filter });
  } catch (err) {
    console.warn(
      `[data-source] alchemy transfers failed for chain ${chainId}, falling back to blockscout`,
      err,
    );
    return fetchBlockscoutTokenTransfers({
      chainId,
      address,
      token,
      filter,
      explorerUrl: blockscoutExplorerUrl,
    });
  }
};
