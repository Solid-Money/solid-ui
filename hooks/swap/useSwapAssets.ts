import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Address, erc20Abi, formatUnits, zeroAddress } from 'viem';
import { fuse } from 'viem/chains';

import { NATIVE_SWAP_ASSETS, SWAP_CHAIN_IDS, swapAssetKey } from '@/constants/swapChains';
import { useAllTokens } from '@/hooks/tokens/useAllTokens';
import useUser from '@/hooks/useUser';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { fetchTokenList } from '@/lib/api';
import { SwapAsset, SwapAssetWithBalance } from '@/lib/types/lifi-swap';
import { multicall3 } from '@/lib/utils/multicall';
import { publicClient } from '@/lib/wagmi';

const SWAP_TOKENS_ALL_CHAINS_KEY = ['swap-tokens', 'all-chains'];

/**
 * Every token the swap form offers, on every swap chain, with the user's
 * balance in each.
 *
 * Fuse keeps its own list (catalogue plus imported tokens, native FUSE first)
 * and a live on-chain balance read, as the Fuse-only picker always had. The
 * other chains come from the same catalogue, with their native currency added,
 * and take their balances from the wallet's multi-chain balance query.
 */
export function useSwapAssets() {
  const { user } = useUser();
  const account = user?.safeAddress as Address | undefined;

  const { tokens: fuseTokens, isLoading: fuseTokensLoading } = useAllTokens(true);

  const { data: catalogue, isLoading: catalogueLoading } = useQuery({
    queryKey: SWAP_TOKENS_ALL_CHAINS_KEY,
    queryFn: () => fetchTokenList({ isActive: true }),
    staleTime: 5 * 60_000,
  });

  const { tokens: walletTokens, isLoading: walletLoading } = useWalletTokens();

  const fuseAddresses = useMemo(
    () => fuseTokens.map(token => token.address.toLowerCase() as Address),
    [fuseTokens],
  );

  // Live Fuse balances, so a token the user just swapped into shows straight
  // away rather than when the indexer catches up.
  const { data: fuseBalances, isLoading: fuseBalancesLoading } = useQuery({
    queryKey: ['swap-fuse-balances', account, fuseAddresses],
    enabled: !!account && fuseAddresses.length > 0,
    queryFn: async () => {
      const erc20s = fuseAddresses.filter(address => address !== zeroAddress);
      const [results, nativeBalance] = await Promise.all([
        multicall3(
          {
            contracts: erc20s.map(address => ({
              address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account!],
            })),
          },
          fuse.id,
        ),
        publicClient(fuse.id).getBalance({ address: account! }),
      ]);
      const balances = new Map<string, bigint>([[zeroAddress, nativeBalance]]);
      erc20s.forEach((address, index) => {
        const result = results[index]?.result;
        if (typeof result === 'bigint') balances.set(address, result);
      });
      return balances;
    },
  });

  const assets = useMemo((): SwapAssetWithBalance[] => {
    // Wallet balances and prices, keyed by chain and address.
    const wallet = new Map<string, { raw: bigint; usdRate: number }>();
    for (const token of walletTokens) {
      let raw = 0n;
      try {
        raw = BigInt(token.balance || '0');
      } catch {
        // A malformed balance reads as none.
      }
      wallet.set(
        swapAssetKey({ chainId: token.chainId, address: token.contractAddress as Address }),
        {
          raw,
          usdRate: token.quoteRate ?? 0,
        },
      );
    }

    const list: SwapAsset[] = [];
    const seen = new Set<string>();
    // What the backend will quote: the swap list, every swap chain's native
    // coin, and on Fuse whatever Algebra routes (the list plus imported tokens).
    const swappable = new Set<string>();
    const add = (asset: SwapAsset, listed: boolean) => {
      const key = swapAssetKey(asset);
      if (listed) swappable.add(key);
      if (seen.has(key)) return;
      seen.add(key);
      list.push(asset);
    };

    for (const token of fuseTokens) {
      add(
        {
          chainId: fuse.id,
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          isNative: token.address === zeroAddress,
        },
        true,
      );
    }

    for (const chainId of SWAP_CHAIN_IDS) {
      if (chainId === fuse.id) continue;
      add(NATIVE_SWAP_ASSETS[chainId], true);
      for (const token of catalogue ?? []) {
        if (token.chainId !== chainId) continue;
        add(
          {
            chainId,
            address: token.address as Address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI,
            isNative: false,
          },
          true,
        );
      }
    }

    // Anything the wallet holds, the picker shows. The wallet limits itself to
    // catalogue tokens plus what the deposit screen takes (soUSD on Base), so a
    // row added here is off the swap list unless the catalogue didn't load, in
    // which case there's no list to judge by and the backend has the last word.
    for (const token of walletTokens) {
      if (!SWAP_CHAIN_IDS.includes(token.chainId) || !token.contractAddress) continue;
      if (
        (wallet.get(
          swapAssetKey({ chainId: token.chainId, address: token.contractAddress as Address }),
        )?.raw ?? 0n) <= 0n
      )
        continue;
      add(
        {
          chainId: token.chainId,
          address: token.contractAddress as Address,
          symbol: token.contractTickerSymbol,
          name: token.contractName,
          decimals: token.contractDecimals || 18,
          logoURI: token.logoUrl,
          isNative: token.contractAddress.toLowerCase() === zeroAddress,
        },
        !catalogue?.length,
      );
    }

    return list.map(asset => {
      const key = swapAssetKey(asset);
      const held = wallet.get(key);
      const live =
        asset.chainId === fuse.id ? fuseBalances?.get(asset.address.toLowerCase()) : undefined;
      const balanceRaw = live ?? held?.raw ?? 0n;
      const balance = Number(formatUnits(balanceRaw, asset.decimals));
      const priceUsd = held?.usdRate ?? 0;
      return {
        ...asset,
        balance,
        balanceRaw,
        balanceUsd: balance * priceUsd,
        priceUsd,
        swappable: swappable.has(key),
      };
    });
  }, [fuseTokens, catalogue, walletTokens, fuseBalances]);

  return {
    assets,
    isLoading:
      fuseTokensLoading ||
      catalogueLoading ||
      (walletLoading && walletTokens.length === 0) ||
      (!!account && fuseBalancesLoading),
  };
}

/** The asset the store has selected for a field, from the swap list. */
export function findSwapAsset(
  assets: SwapAsset[],
  chainId: number,
  address: string | undefined,
): SwapAsset | undefined {
  if (!address) return undefined;
  const key = swapAssetKey({ chainId, address: address as Address });
  const listed = assets.find(asset => swapAssetKey(asset) === key);
  if (listed) return listed;
  return address.toLowerCase() === zeroAddress ? NATIVE_SWAP_ASSETS[chainId] : undefined;
}
