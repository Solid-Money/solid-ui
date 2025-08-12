import { publicClient } from '@/lib/wagmi';
import { MulticallParameters } from 'viem';
import { multicall } from 'viem/actions';

/**
 * https://viem.sh/docs/contract/multicall.html
 * @param multicallParameters
 * @param chainId - Optional chain ID, defaults to fuse
 * @returns
 */
export async function multicall3(multicallParameters: MulticallParameters, chainId?: number) {
  const client = publicClient(chainId || 122);
  return multicall(client, multicallParameters);
}
