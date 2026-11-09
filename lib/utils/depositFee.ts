import { base, fuse, mainnet } from 'viem/chains';

import { isStablecoinSymbol } from '@/constants/stablecoins';
import { CardProvider, DepositFeeQuote } from '@/lib/types';

/**
 * Which crypto deposits pay Solid's deposit fee.
 *
 * A deposit can be charged when it is sent from a chain other than the one its
 * destination lives on. Where that is depends on the flow that handed
 * out the address, and on who it was handed to:
 *
 * | Address              | Who             | Charged on                                  |
 * | -------------------- | --------------- | ------------------------------------------- |
 * | Card (`RAIN_CARD`)   | Rain or no card | Every chain but Base, where the card is     |
 * |                      |                 | funded                                      |
 * | Card (`RAIN_CARD`)   | Either, EURC    | Every chain but Base, where EURC is         |
 * |                      |                 | delivered                                   |
 * | Card (`RAIN_CARD`)   | Wirex           | Stablecoins, on every chain but Base, where |
 * |                      |                 | the Safe the card spends from lives, and    |
 * |                      |                 | Fuse, which delivers to the Safe there      |
 * | Wallet (`WALLET`)    | Anyone          | Stablecoins, on every chain but Base, where |
 * |                      |                 | they are bridged to the Safe. Anything else |
 * |                      |                 | is forwarded to the Safe where it arrived   |
 * | Savings (`PROTOCOL`) | Rain or no card | Every chain but the vault's: Base for soUSD |
 * |                      |                 | and soEURC, Ethereum for soETH, Fuse for    |
 * |                      |                 | soFUSE                                      |
 * | Savings (`PROTOCOL`) | Wirex           | Nothing, for Phase 1                        |
 *
 * The flow decides the address, except on the wallet screen: it mints a
 * `WALLET` address, but a Wirex cardholder's dollars on Fuse get a card one
 * (see `getWalletOwnAddress`), so the screen says which it handed out.
 *
 * The client collects nothing here. This only decides whether a deposit address
 * screen warns that the deposit will be charged, so a rule that changes belongs
 * in this file rather than in the screens.
 *
 * The rate is the backend's. Admins can price each route and chain on their own
 * from the Deposit fees page, so a charged deposit asks `/deposit/fee-quote`
 * what it pays, and the backend answers 0.03% for anything not set there. The
 * table above only decides which deposits are worth asking about: an address
 * that is never bridged is never charged, whatever the grid says.
 *
 * A leaf module, like `cardFunding`, so it can be tested under jest-expo without
 * pulling in `lib/assets`.
 */

/**
 * The rate a charged deposit pays when no other is set for its route and chain:
 * 3 bps, i.e. 0.03%. In parts per million, as the backend quotes it, so a rate
 * set in fractions of a basis point (0.025%) is still exact.
 *
 * Only quoted when the backend cannot be asked.
 */
export const DEFAULT_DEPOSIT_FEE_RATE_PPM = 300;

/**
 * The flow a deposit address was handed out by: "Fund your card", the wallet
 * deposit screen, or a savings vault's direct deposit.
 */
export type DepositFeeProduct = 'card' | 'wallet' | 'savings';

/**
 * The chain each vault's deposits mint on, keyed by the share token. soUSD's
 * moved from Ethereum to Base, so a soUSD deposit sent on Ethereum is now
 * bridged to Base and charged, and one sent on Base is free.
 */
const VAULT_CHAIN_IDS: Record<string, number> = {
  soUSD: base.id,
  soETH: mainnet.id,
  soFUSE: fuse.id,
  soEURC: base.id,
};

/** The kind of address the backend prices a deposit on. */
export type DepositFeeDestinationType = 'PROTOCOL' | 'RAIN_CARD' | 'WALLET';

/**
 * Whether this deposit can be charged: the default rate in parts per million
 * when it can, 0 when it is free by rule.
 *
 * Only a Wirex card changes the card rules. No card, a Rain card and the
 * deprecated Bridge card (which `useCardProvider` already reports as no card)
 * all follow the Rain rows. The wallet's own address is priced the same for
 * everyone (the backend books it on the Rain card row, for every program).
 */
export function getDepositFeeRatePpm({
  provider,
  product,
  chainId,
  symbol,
  vaultToken,
  walletAddress,
}: {
  /** The user's card issuer, or null when they have no card. */
  provider: CardProvider | null | undefined;
  product: DepositFeeProduct;
  /** Chain the deposit is sent on. */
  chainId: number;
  /** Currency being sent. */
  symbol?: string;
  /** Share token a savings deposit mints (soUSD, soETH, soFUSE, soEURC). Unused otherwise. */
  vaultToken?: string;
  /**
   * The kind of address the wallet screen minted: `WALLET` unless it was a
   * card one (a Wirex cardholder's dollars on Fuse). Unused otherwise.
   */
  walletAddress?: 'WALLET' | 'RAIN_CARD';
}): number {
  const isWirex = provider === CardProvider.WIREX;
  const destinationType = getDepositFeeDestinationType(product, walletAddress);

  // The wallet's own address bridges the dollar stablecoins to the Safe on
  // Base, and forwards anything else to the Safe on the chain it arrived on,
  // which costs nothing. So only a dollar stablecoin sent off Base is charged,
  // whoever sends it.
  if (destinationType === 'WALLET') {
    return isStablecoinSymbol(symbol) && chainId !== base.id ? DEFAULT_DEPOSIT_FEE_RATE_PPM : 0;
  }

  // A EURC card deposit goes to the Safe on Base whoever issued the card, so it
  // is charged only when it has to be bridged there.
  const isEurc = symbol?.toUpperCase() === 'EURC';
  if (isEurc && destinationType === 'RAIN_CARD') {
    return chainId === base.id ? 0 : DEFAULT_DEPOSIT_FEE_RATE_PPM;
  }

  if (product === 'savings') {
    if (isWirex) return 0;

    // A vault this table does not place gets no notice rather than a guess:
    // telling someone a free deposit will be charged is worse than leaving the
    // line off.
    const vaultChainId = vaultToken ? VAULT_CHAIN_IDS[vaultToken] : undefined;
    if (vaultChainId === undefined) return 0;

    return chainId === vaultChainId ? 0 : DEFAULT_DEPOSIT_FEE_RATE_PPM;
  }

  // A Wirex card holds no balance of its own, so funding it is funding the Safe
  // it spends from: on Base, or on Fuse for a deposit sent on Fuse. Either is
  // free; anything else is bridged to Base. Only stablecoins are routed there
  // by the deposit pipeline; ETH and FUSE are sent straight to the Safe.
  if (isWirex) {
    return isStablecoinSymbol(symbol) && chainId !== base.id && chainId !== fuse.id
      ? DEFAULT_DEPOSIT_FEE_RATE_PPM
      : 0;
  }

  return chainId === base.id ? 0 : DEFAULT_DEPOSIT_FEE_RATE_PPM;
}

/**
 * The deposit address the backend prices a flow's deposit on: savings'
 * `PROTOCOL` address, the card's `RAIN_CARD` one (which the backend delivers to
 * whichever card the user holds - the Rain card on Base, a Wirex card's Safe on
 * Base or on Fuse, or the Safe on Base for EURC), and for the wallet the kind
 * of address the screen minted, `WALLET` unless it says otherwise.
 */
export const getDepositFeeDestinationType = (
  product: DepositFeeProduct,
  walletAddress: 'WALLET' | 'RAIN_CARD' = 'WALLET',
): DepositFeeDestinationType =>
  product === 'savings' ? 'PROTOCOL' : product === 'card' ? 'RAIN_CARD' : walletAddress;

/**
 * The rate the notice quotes, or undefined while it is still being asked for.
 *
 * Free by rule stays free without asking. Otherwise the backend decides, since
 * it is what charges: its rate for the route and chain, or 0 when it would not
 * charge this deposit (a route set to 0%, the fee switched off). If it cannot
 * be asked, the notice falls back to the default rate rather than to nothing:
 * saying a deposit is free when it is charged is the worse mistake.
 */
export function resolveDepositFeeRatePpm({
  rulePpm,
  quote,
  quoteFailed,
}: {
  /** What `getDepositFeeRatePpm` says. */
  rulePpm: number;
  quote: Pick<DepositFeeQuote, 'applies' | 'ratePpm'> | undefined;
  quoteFailed: boolean;
}): number | undefined {
  if (!rulePpm) return 0;
  if (quote) return quote.applies ? quote.ratePpm : 0;
  return quoteFailed ? rulePpm : undefined;
}

/**
 * Parts per million as the percentage the notice quotes: 300 → "0.03%",
 * 250 → "0.025%". Integer arithmetic, so no rate prints as 0.029999…%.
 */
export function formatDepositFeePercent(ratePpm: number): string {
  const whole = Math.floor(ratePpm / 10_000);
  const frac = String(ratePpm % 10_000)
    .padStart(4, '0')
    .replace(/0+$/, '');
  return `${whole}${frac ? `.${frac}` : ''}%`;
}
