import { arbitrum, base, bsc, mainnet, polygon } from 'viem/chains';

import { getRhinoChainsForDestination } from '@/lib/rhinoDeposit';

import type { RhinoDepositAssetsResponse, RhinoDestinationType } from '@/lib/types';

/**
 * Funding the AI API: what it takes, and from where.
 *
 * Its charges are drawn from USDC in the user's Safe on Base, so every way in
 * ends there as USDC:
 *
 * - Money from outside Solid (an exchange, another wallet) goes through
 *   rhino.fi's AI API route, which pays the Safe on Base in USDC whatever it is
 *   sent as. USDC sent on Base is already there, so the Safe's own address takes
 *   it, free.
 * - Money already in the user's Solid wallet, on any network, Fuse included,
 *   goes through the in-app swap into USDC on Base.
 *
 * A leaf module with no asset or React imports, so the rules are unit testable.
 */

/** The rhino.fi destination for money sent to pay for the AI API. */
export const AI_API_RHINO_DESTINATION: RhinoDestinationType = 'AI_API';

/**
 * What can be sent for the AI API, in display order: every one is converted to
 * USDC on the way. Not EURC, which rhino.fi never converts and the AI API cannot
 * charge.
 */
export const AI_API_FUND_TOKENS: readonly string[] = ['USDC', 'USDT', 'ETH', 'BTC'];

/**
 * The app's own networks the AI API's address step lists, in the wallet's
 * order. Not Fuse: rhino.fi does not take it, and money on Fuse cannot pay for
 * the AI API (the swap moves it). The chains rhino.fi serves that the app has
 * no row for (Tron, Solana, Bitcoin, …) follow these, as "More networks".
 */
export const AI_API_FUND_CHAIN_IDS: readonly number[] = [
  mainnet.id,
  polygon.id,
  base.id,
  arbitrum.id,
  bsc.id,
];

/**
 * Whether one of those networks may be served by our own address instead of
 * rhino.fi's: USDC on Base alone, which is already what pays for the AI API, so
 * the Safe takes it as it is. Every other row our own pipeline would serve
 * (Fuse, or any row while the backend has rhino.fi off) lands somewhere the AI
 * API cannot charge, so it is not offered.
 */
export const isAiApiOwnRow = (chainId: number, symbol: string): boolean =>
  chainId === base.id && symbol === 'USDC';

/**
 * The networks a token row names: the first two, then a "+N" for the rest, so
 * the row stays one line. Every chain rhino.fi's AI API route takes the token
 * from, Base's own USDC row included, by the app's own name for it where it
 * has one.
 */
export const getAiApiFundChips = (
  assets: RhinoDepositAssetsResponse | undefined,
  symbol: string,
  appChainName: (chainId: number) => string | undefined,
): string[] => {
  const names = getRhinoChainsForDestination(assets, {
    destinationType: AI_API_RHINO_DESTINATION,
    symbol,
  }).map(chain => (chain.chainId !== undefined && appChainName(chain.chainId)) || chain.name);
  const visible = names.slice(0, 2);
  const remaining = names.length - visible.length;
  return remaining > 0 ? [...visible, `+${remaining}`] : visible;
};

/**
 * What to tell someone whose agents are waiting for money: how much is
 * missing, when the backend says. Undefined when nothing is, or it can't tell.
 */
export const formatAiApiShortfall = (
  shortfallUsd: number | null | undefined,
): string | undefined =>
  shortfallUsd && shortfallUsd > 0
    ? `Add at least $${shortfallUsd.toFixed(2)} to start your agents again.`
    : undefined;
