import { fuse } from 'viem/chains';

/**
 * One asset a card is allowed to spend.
 *
 * Matched against the Safe's token balances by ticker, so an entry needs no
 * addresses: `useBalances` already prices every holding, and it prices soUSD off
 * the vault's own share rate — the same source the Savings figure uses — so the
 * two agree rather than drifting by a price feed.
 */
export interface CardSpendableAsset {
  /** Ticker as it appears in wallet balances ("soUSD", "USDC"). */
  symbol: string;
  /**
   * Chains the card can reach this asset on. Omit for "wherever the Safe holds
   * it"; list them when the settlement mechanism is chain-bound, as the soUSD
   * pull is.
   */
  chainIds?: number[];
}

/**
 * What a card with no balance of its own can spend, and therefore what the
 * "Spendable" row in the home balance breakdown adds up.
 *
 * Today: soUSD on Fuse. A Wirex purchase is paid by Wirex out of its own Master
 * Account and reimbursed by pulling soUSD from the user's Safe on Fuse at
 * settlement, so soUSD held on any other chain is not reachable and is
 * deliberately left out — counting it would show the user spending power they do
 * not have.
 *
 * This list is the one place to extend when the card learns to spend more, be it
 * another yield asset (soETH, soFUSE) or a plain stablecoin (USDC, USDT): add the
 * entry and the row, plus everything derived from it, follows. Keep it in step
 * with what the backend will actually settle from — this side of the app cannot
 * tell whether a listed asset is really pullable.
 */
export const CARD_SPENDABLE_ASSETS: CardSpendableAsset[] = [
  { symbol: 'soUSD', chainIds: [fuse.id] },
];
