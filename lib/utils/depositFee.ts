import { base, fuse, mainnet } from 'viem/chains';

import { isStablecoinSymbol } from '@/constants/stablecoins';
import { CardProvider } from '@/lib/types';

/**
 * Which crypto deposits pay Solid's deposit fee.
 *
 * A deposit pays `DEPOSIT_FEE_BPS` when it is sent from a chain other than the
 * one its destination lives on. Where that is depends on the flow that handed
 * out the address, and on who it was handed to:
 *
 * | Flow           | Who             | Charged on                                        |
 * | -------------- | --------------- | ------------------------------------------------- |
 * | Fund your card | Rain            | Every chain but Base, where the card is funded    |
 * | Wallet         | Wirex           | Stablecoins, on every chain but Fuse, where the   |
 * |                |                 | Safe the card spends from lives                   |
 * | Wallet         | No card         | Nothing                                           |
 * | Savings        | Rain or no card | Every chain but the vault's: Ethereum for soUSD   |
 * |                |                 | and soETH, Fuse for soFUSE                        |
 * | Savings        | Wirex           | Nothing, for Phase 1                              |
 *
 * The client collects nothing here. This only decides whether a deposit address
 * screen warns that the deposit will be charged, so a rule that changes belongs
 * in this file rather than in the screens.
 *
 * A leaf module, like `cardFunding`, so it can be tested under jest-expo without
 * pulling in `lib/assets`.
 */

/** The fee on a deposit that is charged: 3 bps, i.e. 0.03%. */
export const DEPOSIT_FEE_BPS = 3;

/**
 * The flow a deposit address was handed out by: "Fund your card", the wallet
 * deposit screen, or a savings vault's direct deposit.
 */
export type DepositFeeProduct = 'card' | 'wallet' | 'savings';

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
  symbol,
  vaultToken,
}: {
  /** The user's card issuer, or null when they have no card. */
  provider: CardProvider | null | undefined;
  product: DepositFeeProduct;
  /** Chain the deposit is sent on. */
  chainId: number;
  /** Currency being sent. Only a Wirex cardholder's fee depends on it. */
  symbol?: string;
  /** Share token a savings deposit mints (soUSD, soETH, soFUSE). Unused otherwise. */
  vaultToken?: string;
}): number {
  const isWirex = provider === CardProvider.WIREX;

  if (product === 'savings') {
    if (isWirex) return 0;

    // A vault this table does not place gets no notice rather than a guess:
    // telling someone a free deposit will be charged is worse than leaving the
    // line off.
    const vaultChainId = vaultToken ? VAULT_CHAIN_IDS[vaultToken] : undefined;
    if (vaultChainId === undefined) return 0;

    return chainId === vaultChainId ? 0 : DEPOSIT_FEE_BPS;
  }

  // A Wirex card holds no balance of its own, so funding it is funding the Safe
  // on Fuse, whichever flow the address came from. Only stablecoins are routed
  // there by the deposit pipeline; ETH and FUSE are sent straight to the Safe.
  if (isWirex) {
    return isStablecoinSymbol(symbol) && chainId !== fuse.id ? DEPOSIT_FEE_BPS : 0;
  }

  if (product === 'card') return chainId === base.id ? 0 : DEPOSIT_FEE_BPS;

  // The wallet flow charges cardholders only. Rain cardholders are sent to "Fund
  // your card" instead, so whoever is left here has no card.
  return 0;
}

/** Basis points as the percentage the notice quotes: 3 → "0.03%". */
export const formatDepositFeePercent = (bps: number): string => `${bps / 100}%`;
