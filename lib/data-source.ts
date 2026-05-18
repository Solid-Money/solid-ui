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

/**
 * Source attribution for the most recent token-balances fetch per chain.
 * Read by the Sentry diagnostic in useBalances to attribute empty results
 * to either Alchemy or the Blockscout fallback. Updated by
 * `fetchTokenBalancesWithFallback` on every call.
 * TODO: remove together with the balances diagnostics after fix.
 */
export type TokenBalancesFetchSource = 'alchemy' | 'blockscout' | 'none';

export interface TokenBalancesFetchTrace {
  source: TokenBalancesFetchSource;
  alchemyError?: string;
  blockscoutError?: string;
  rawCount: number;
  timestamp: number;
}

const lastTokenBalancesTrace = new Map<number, TokenBalancesFetchTrace>();

export const getLastTokenBalancesTrace = (
  chainId: number,
): TokenBalancesFetchTrace | undefined => lastTokenBalancesTrace.get(chainId);

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
  const recordTrace = (trace: TokenBalancesFetchTrace) => {
    lastTokenBalancesTrace.set(chainId, trace);
  };

  if (!isAlchemyChain(chainId)) {
    try {
      const result = await fetchBlockscoutTokenBalances(chainId, address);
      recordTrace({ source: 'blockscout', rawCount: result.length, timestamp: Date.now() });
      return result;
    } catch (err) {
      recordTrace({
        source: 'none',
        blockscoutError: err instanceof Error ? err.message : String(err),
        rawCount: 0,
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  try {
    const result = await fetchAlchemyTokenBalances(chainId, address);
    recordTrace({ source: 'alchemy', rawCount: result.length, timestamp: Date.now() });
    return result;
  } catch (alchemyErr) {
    const alchemyMessage = alchemyErr instanceof Error ? alchemyErr.message : String(alchemyErr);
    console.warn(
      `[data-source] alchemy balances failed for chain ${chainId}, falling back to blockscout`,
      alchemyErr,
    );
    try {
      const result = await fetchBlockscoutTokenBalances(chainId, address);
      recordTrace({
        source: 'blockscout',
        alchemyError: alchemyMessage,
        rawCount: result.length,
        timestamp: Date.now(),
      });
      return result;
    } catch (blockscoutErr) {
      recordTrace({
        source: 'none',
        alchemyError: alchemyMessage,
        blockscoutError:
          blockscoutErr instanceof Error ? blockscoutErr.message : String(blockscoutErr),
        rawCount: 0,
        timestamp: Date.now(),
      });
      throw blockscoutErr;
    }
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
