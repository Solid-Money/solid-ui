import { base, fuse, mainnet } from 'viem/chains';

import { CardProvider } from '@/lib/types';

/**
 * Which crypto deposits pay Solid's deposit fee.
 *
 * A deposit is free when it is sent on the chain its destination lives on, and
 * pays `DEPOSIT_FEE_BPS` from any other chain. Where the destination lives
 * depends on the card program and on what the deposit funds:
 *
 * | Program         | Product | Free from                                            |
 * | --------------- | ------- | ---------------------------------------------------- |
 * | Wirex           | Card    | Fuse, where the Safe the card spends from lives      |
 * | Wirex           | Savings | Every chain, for Phase 1                             |
 * | Rain or no card | Card    | Base, where the Rain card is funded                  |
 * | Rain or no card | Savings | The vault's chain: Ethereum for soUSD and soETH,     |
 * |                 |         | Fuse for soFUSE                                      |
 *
 * The client collects nothing here. This only decides whether a deposit address
 * screen warns that the deposit will be charged, so a rule that changes belongs
 * in this file rather than in the screens.
 *
 * A leaf module, like `cardFunding`, so it can be tested under jest-expo without
 * pulling in `lib/assets`.
 */

/** The fee on a deposit sent from a chain it is not free on: 3 bps, i.e. 0.03%. */
export const DEPOSIT_FEE_BPS = 3;

/** What a deposit funds: the card, or a savings vault. */
export type DepositFeeProduct = 'card' | 'savings';

/** The chain each vault lives on, keyed by the share token it mints. */
const VAULT_CHAIN_IDS: Record<string, number> = {
  soUSD: mainnet.id,
  soETH: mainnet.id,
  soFUSE: fuse.id,
};

/**
 * The fee in basis points on this deposit, or 0 when it is free.
 *
 * Only a Wirex card changes the rules. No card, a Rain card and the deprecated
 * Bridge card (which `useCardProvider` already reports as no card) all follow
 * the Rain rows.
 */
export function getDepositFeeBps({
  provider,
  product,
  chainId,
  vaultToken,
}: {
  /** The user's card issuer, or null when they have no card. */
  provider: CardProvider | null | undefined;
  product: DepositFeeProduct;
  /** Chain the deposit is sent on. */
  chainId: number;
  /** Share token a savings deposit mints (soUSD, soETH, soFUSE). Unused for the card. */
  vaultToken?: string;
}): number {
  const isWirex = provider === CardProvider.WIREX;

  if (product === 'card') {
    const freeChainId = isWirex ? fuse.id : base.id;
    return chainId === freeChainId ? 0 : DEPOSIT_FEE_BPS;
  }

  if (isWirex) return 0;

  // A vault this table does not place gets no notice rather than a guess: telling
  // someone a free deposit will be charged is worse than leaving the line off.
  const vaultChainId = vaultToken ? VAULT_CHAIN_IDS[vaultToken] : undefined;
  if (vaultChainId === undefined) return 0;

  return chainId === vaultChainId ? 0 : DEPOSIT_FEE_BPS;
}

/** Basis points as the percentage the notice quotes: 3 → "0.03%". */
export const formatDepositFeePercent = (bps: number): string => `${bps / 100}%`;
