import axios from 'axios';
import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { isAlchemyChain } from '@/constants/alchemy';
import { explorerUrls } from '@/constants/explorers';
import { fetchAlchemyTokenBalances, fetchAlchemyTokenTransfers } from '@/lib/alchemy';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { BlockscoutTransactions } from '@/lib/types';

import type { BlockscoutTokenBalance } from '@/hooks/useBalances';

/**
 * Dispatcher: tries Alchemy first, falls back to Blockscout on failure.
 * Fuse (122) is always Blockscout (not supported by Alchemy).
 */

/**
 * Deadline for a Blockscout request.
 *
 * These calls gate the wallet balance skeleton, and nothing times out a bare
 * `fetch` on its own — so an explorer that accepts the connection and then
 * stops responding used to hold the home screen in its loading state
 * indefinitely rather than failing over or rendering what it has. Matches the
 * timeout already applied to Alchemy.
 */
const BLOCKSCOUT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * A dedicated axios instance for Blockscout.
 *
 * The global axios in `lib/api.ts` carries a request interceptor that attaches
 * the user's Solid backend JWT to every request on iOS/Android. Blockscout is a
 * third-party explorer that has no use for that token and should never receive
 * it — the same reasoning behind `externalAxios` and `alchemyAxios`. Declared
 * here rather than imported from `lib/api.ts` because that module imports this
 * one, so sharing the instance would close an import cycle.
 *
 * `axios.create()` starts with no interceptors, so this sends neither the JWT
 * nor the platform headers, and carries its own deadline.
 */
const blockscoutAxios = axios.create({ timeout: BLOCKSCOUT_REQUEST_TIMEOUT_MS });

/**
 * A Blockscout instance that is up but slow should not cost the user the
 * balances every *other* chain already returned. `fetchTokenBalances` collects
 * these with `Promise.allSettled`, so a rejection here degrades one chain;
 * hanging degrades the whole screen.
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
  const response = await fetchWithTimeout(
    `${url}/api/v2/addresses/${address}/token-balances`,
    { headers: { accept: 'application/json' } },
    BLOCKSCOUT_REQUEST_TIMEOUT_MS,
  );
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
  const response = await blockscoutAxios.get<BlockscoutTransactions>(
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
  } catch (alchemyErr) {
    console.warn(
      `[data-source] alchemy balances failed for chain ${chainId}, falling back to blockscout`,
      alchemyErr,
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
