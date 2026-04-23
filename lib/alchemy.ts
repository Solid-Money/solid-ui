import axios from 'axios';

import { ALCHEMY_CHAIN_URLS, ALCHEMY_REQUEST_TIMEOUT_MS } from '@/constants/alchemy';
import { BlockscoutTransaction, BlockscoutTransactions, TokenType } from '@/lib/types';

import type { BlockscoutTokenBalance } from '@/hooks/useBalances';

/**
 * Thin Alchemy JSON-RPC client plus mappers that shape responses into the
 * existing `BlockscoutTokenBalance` / `BlockscoutTransactions` types so
 * consumers (useBalances, fetchTokenTransfer) don't need to change.
 *
 * Native balances are NOT fetched here — viem `getBalance` handles that.
 */

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

interface AlchemyTokenBalancesResult {
  address: string;
  tokenBalances: { contractAddress: string; tokenBalance: string | null }[];
  pageKey?: string;
}

interface AlchemyTokenMetadata {
  decimals: number | null;
  logo: string | null;
  name: string | null;
  symbol: string | null;
}

export type AlchemyTransferCategory = 'external' | 'erc20' | 'erc721' | 'erc1155';

interface AlchemyAssetTransfer {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: AlchemyTransferCategory;
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata: { blockTimestamp: string };
}

interface AlchemyAssetTransfersResult {
  transfers: AlchemyAssetTransfer[];
  pageKey?: string;
}

const jsonRpc = async <T>(chainId: number, method: string, params: unknown[]): Promise<T> => {
  const url = ALCHEMY_CHAIN_URLS[chainId];
  if (!url) throw new Error(`No Alchemy URL configured for chain ${chainId}`);
  const response = await axios.post<JsonRpcResponse<T>>(
    url,
    { jsonrpc: '2.0', id: 1, method, params },
    { timeout: ALCHEMY_REQUEST_TIMEOUT_MS },
  );
  if (response.data.error) {
    throw new Error(
      `Alchemy ${method} error ${response.data.error.code}: ${response.data.error.message}`,
    );
  }
  if (response.data.result === undefined) {
    throw new Error(`Alchemy ${method} returned no result`);
  }
  return response.data.result;
};

// Module-level cache for token metadata. Immutable per contract; no TTL
// needed for a single app session on mobile.
const metadataCache = new Map<string, AlchemyTokenMetadata>();
const metadataCacheKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

/**
 * Resolve metadata for a batch of contract addresses using a single JSON-RPC
 * batch request. Results are populated into the shared metadata cache.
 */
const alchemyGetTokenMetadataBatch = async (
  chainId: number,
  addresses: string[],
): Promise<void> => {
  const url = ALCHEMY_CHAIN_URLS[chainId];
  if (!url) return;

  const toFetch = addresses.filter(addr => !metadataCache.has(metadataCacheKey(chainId, addr)));
  if (toFetch.length === 0) return;

  const body = toFetch.map((addr, idx) => ({
    jsonrpc: '2.0',
    id: idx,
    method: 'alchemy_getTokenMetadata',
    params: [addr],
  }));

  try {
    const response = await axios.post<JsonRpcResponse<AlchemyTokenMetadata>[]>(url, body, {
      timeout: ALCHEMY_REQUEST_TIMEOUT_MS,
    });
    const data = Array.isArray(response.data) ? response.data : [];
    for (const entry of data) {
      const idx = Number(entry.id);
      if (Number.isFinite(idx) && toFetch[idx]) {
        const meta = entry.result ?? {
          decimals: null,
          logo: null,
          name: null,
          symbol: null,
        };
        metadataCache.set(metadataCacheKey(chainId, toFetch[idx]), meta);
      }
    }
  } catch {
    // Populate cache with empty entries so we don't retry endlessly.
    for (const addr of toFetch) {
      metadataCache.set(metadataCacheKey(chainId, addr), {
        decimals: null,
        logo: null,
        name: null,
        symbol: null,
      });
    }
  }
};

/**
 * Fetch ERC-20 balances from Alchemy and map into the existing
 * `BlockscoutTokenBalance` shape so `convertBlockscoutToTokenBalance` in
 * useBalances can consume it without changes.
 *
 * Native balance (ETH, MATIC) is not included — handled via viem `getBalance`
 * in useBalances as before.
 */
export const fetchAlchemyTokenBalances = async (
  chainId: number,
  address: string,
): Promise<BlockscoutTokenBalance[]> => {
  // Paginate via pageKey so wallets with >100 tokens aren't truncated.
  const tokenBalances: { contractAddress: string; tokenBalance: string | null }[] = [];
  let pageKey: string | undefined;
  // Safety cap at 10 pages (≈1000 tokens) to bound worst case.
  for (let i = 0; i < 10; i++) {
    const params: unknown[] = [address, 'erc20'];
    if (pageKey) params.push({ pageKey });
    const page = await jsonRpc<AlchemyTokenBalancesResult>(
      chainId,
      'alchemy_getTokenBalances',
      params,
    );
    tokenBalances.push(...(page.tokenBalances ?? []));
    if (!page.pageKey) break;
    pageKey = page.pageKey;
  }

  const nonZero = tokenBalances.filter(b => {
    if (!b.tokenBalance) return false;
    try {
      return BigInt(b.tokenBalance) !== 0n;
    } catch {
      return false;
    }
  });

  if (nonZero.length === 0) return [];

  await alchemyGetTokenMetadataBatch(
    chainId,
    nonZero.map(b => b.contractAddress),
  );

  return nonZero.map(b => {
    const meta = metadataCache.get(metadataCacheKey(chainId, b.contractAddress)) ?? {
      decimals: null,
      logo: null,
      name: null,
      symbol: null,
    };
    const decimalsNum = meta.decimals ?? 18;
    const value = BigInt(b.tokenBalance ?? '0x0').toString();
    return {
      token: {
        address: b.contractAddress,
        address_hash: b.contractAddress,
        decimals: String(decimalsNum),
        name: meta.name ?? '',
        symbol: meta.symbol ?? '',
        type: TokenType.ERC20,
        icon_url: meta.logo ?? undefined,
        exchange_rate: undefined,
      },
      token_id: null,
      token_instance: null,
      value,
    };
  });
};

/**
 * Fetch token transfers for an address from Alchemy and map into the existing
 * `BlockscoutTransactions` shape.
 */
export const fetchAlchemyTokenTransfers = async ({
  chainId,
  address,
  token,
  filter = 'to',
}: {
  chainId: number;
  address: string;
  token?: string;
  filter?: 'from' | 'to';
}): Promise<BlockscoutTransactions> => {
  const category: AlchemyTransferCategory[] = token ? ['erc20'] : ['erc20', 'external'];

  const baseParams: Record<string, unknown> = {
    category,
    excludeZeroValue: true,
    order: 'desc',
    withMetadata: true,
    maxCount: '0x64', // 100
  };
  if (filter === 'from') baseParams.fromAddress = address;
  else baseParams.toAddress = address;
  if (token) baseParams.contractAddresses = [token];

  const result = await jsonRpc<AlchemyAssetTransfersResult>(chainId, 'alchemy_getAssetTransfers', [
    baseParams,
  ]);

  // Resolve metadata for any ERC-20 contracts in the batch.
  const erc20Addrs = Array.from(
    new Set(
      result.transfers
        .filter(t => t.category === 'erc20')
        .map(t => t.rawContract.address?.toLowerCase())
        .filter((a): a is string => !!a),
    ),
  );
  if (erc20Addrs.length) {
    await alchemyGetTokenMetadataBatch(chainId, erc20Addrs);
  }

  const items: BlockscoutTransaction[] = result.transfers.map(t => {
    const contractAddr = t.rawContract.address ?? '';
    const meta = contractAddr
      ? metadataCache.get(metadataCacheKey(chainId, contractAddr))
      : undefined;
    const decimals =
      meta?.decimals ?? (t.rawContract.decimal ? parseInt(t.rawContract.decimal, 16) : 18);
    return {
      to: {
        hash: (t.to ?? '') as `0x${string}`,
        name: '',
      },
      token: {
        address: (contractAddr || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        symbol: meta?.symbol ?? t.asset ?? '',
        icon_url: meta?.logo ?? '',
      },
      total: {
        decimals: String(decimals),
        value: t.rawContract.value ? BigInt(t.rawContract.value).toString() : '0',
      },
      transaction_hash: t.hash,
      timestamp: t.metadata.blockTimestamp,
      type: t.category === 'external' ? 'coin_transfer' : 'token_transfer',
    };
  });

  return { items };
};
