import { zeroAddress } from 'viem';
import { fuse } from 'viem/chains';

import { USDC_STARGATE } from '@/constants/addresses';
import { TokenBalance, TokenType } from '@/lib/types';

export interface SwapSide {
  address: string;
  chainId: number;
}

export interface SwapPreset {
  input?: SwapSide;
  output?: SwapSide;
}

/** USD Yield (soUSD, `soUSDC_TOKEN`) on Fuse. Not imported: constants/tokens loads the asset bundle. */
export const USD_YIELD_ON_FUSE: SwapSide = {
  address: '0x75333830E7014e909535389a6E5b0C02aA62ca27',
  chainId: fuse.id,
};
/** USDC on Fuse, the coin the app spends and sends. */
export const USDC_ON_FUSE: SwapSide = { address: USDC_STARGATE, chainId: fuse.id };

/** Home's Swap: out of USD Yield into USDC, the one most people make. */
export const HOME_SWAP_PRESET: Required<SwapPreset> = {
  input: USD_YIELD_ON_FUSE,
  output: USDC_ON_FUSE,
};

const sameSide = (a: SwapSide, b: SwapSide) =>
  a.chainId === b.chainId && a.address.toLowerCase() === b.address.toLowerCase();

const holds = (token: TokenBalance) => {
  try {
    return BigInt(token.balance || '0') > 0n;
  } catch {
    return false;
  }
};

/**
 * A coin page's Swap opens on its coin: paying with it when it's held,
 * getting it with USDC when it isn't. USDC's own page pairs it with USD Yield.
 */
export function coinSwapPreset(token: TokenBalance | undefined): SwapPreset {
  if (!token) return {};
  const coin: SwapSide = {
    address: token.type === TokenType.NATIVE ? zeroAddress : token.contractAddress,
    chainId: token.chainId,
  };
  const other = sameSide(coin, USDC_ON_FUSE) ? USD_YIELD_ON_FUSE : USDC_ON_FUSE;
  return holds(token) ? { input: coin, output: other } : { input: other, output: coin };
}
