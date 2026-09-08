import { fuse } from 'viem/chains';

import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { ADDRESSES } from '@/lib/config';

/**
 * One asset a card is allowed to spend.
 *
 * Matched against the Safe's token balances: by ticker, and by address when one is
 * given. `useBalances` already prices every holding, and it prices soUSD off the
 * vault's own share rate — the same source the Savings figure uses — so the two agree
 * rather than drifting by a price feed.
 */
export interface CardSpendableAsset {
  /**
   * Ticker as it appears in wallet balances ("soUSD", "USDC").
   *
   * Optional, and ignored entirely when {@link addresses} is set — see there. Use it
   * alone only for an asset the card can spend wherever it is held.
   */
  symbol?: string;
  /**
   * Chains the card can reach this asset on. Omit for "wherever the Safe holds it";
   * list them when the settlement mechanism is chain-bound, as the Safe debit is.
   */
  chainIds?: number[];
  /**
   * Exact contract addresses, lower-cased. **Decisive when set: `symbol` is not
   * checked at all.**
   *
   * Two independent reasons, and each one alone would justify it.
   *
   * Over-reporting: Fuse carries several contracts per stablecoin ticker — bridged,
   * legacy, pegswapped — and `SolidCashModule` allowlists exactly one of each. A
   * ticker match would count a legacy holding the card cannot reach, quoting spending
   * power that then declines at the terminal.
   *
   * Under-reporting: the ticker in wallet balances is whatever the indexer says, not
   * the address. Blockscout reports this USDC as `USDC.E`, and it only reads as "USDC"
   * because `useBalances` happens to carry a `'USDC.E' -> 'USDC'` normalisation whose
   * key matches that exact casing. A rename upstream, or a token whose casing the map
   * does not cover, would silently drop the asset from this row — and a *missing*
   * asset is the harder failure to notice, because nothing looks broken.
   *
   * The address is what the on-chain allowlist is keyed on, so matching it is matching
   * the actual contract. soUSD carries one too even though its ticker is unambiguous:
   * `ADDRESSES.fuse.vault` is environment-specific, and pinning it keeps a staging
   * build from counting the production vault or vice versa.
   */
  addresses?: string[];
}

/**
 * What a card with no balance of its own can spend, and therefore what the
 * "Spendable" row in the home balance breakdown adds up.
 *
 * USDC, USDT and soUSD on Fuse, in the order the backend actually draws from them.
 * A Wirex purchase is paid by Wirex out of its own Master Account and reimbursed by
 * debiting the user's Safe on Fuse through `SolidCashModule` at settlement, so any of
 * these held on another chain is not reachable and is deliberately left out —
 * counting it would show the user spending power they do not have.
 *
 * This list must stay in step with the module's on-chain allowlist, which is admin
 * configuration rather than a deploy. An asset allowlisted on-chain but missing here
 * is merely under-reported; an asset listed here but *not* allowlisted on-chain is
 * over-reported, and that one is a decline the user cannot explain — so when the two
 * disagree, err on leaving an entry out.
 */
export const CARD_SPENDABLE_ASSETS: CardSpendableAsset[] = [
  // `symbol` here is documentation only — `addresses` is what actually matches.
  { symbol: 'USDC', chainIds: [fuse.id], addresses: [USDC_STARGATE.toLowerCase()] },
  { symbol: 'USDT', chainIds: [fuse.id], addresses: [USDT_STARGATE.toLowerCase()] },
  { symbol: 'soUSD', chainIds: [fuse.id], addresses: [ADDRESSES.fuse.vault.toLowerCase()] },
];

/**
 * The spendable set in words, for the "Spendable" tooltip — "USDC, USDT and soUSD
 * on Fuse".
 *
 * Derived from {@link CARD_SPENDABLE_ASSETS} rather than written out, because a
 * hardcoded sentence beside a list that is expected to change is a sentence that
 * will eventually name an asset the card cannot reach. That is the same
 * over-reporting failure the list's own doc warns about, just in prose: the user
 * is told they can spend something, and the terminal disagrees.
 *
 * Chain-name resolution is deliberately narrow. Every entry is Fuse-only today and
 * the settlement mechanism is chain-bound, so a multi-chain entry would be a change
 * worth writing copy for rather than one to interpolate blindly — an entry with no
 * `chainIds`, or with more than one, contributes its symbol and no network clause.
 */
export const describeCardSpendableAssets = (
  assets: CardSpendableAsset[] = CARD_SPENDABLE_ASSETS,
): string => {
  const symbols = assets.map(asset => asset.symbol).filter((symbol): symbol is string => !!symbol);
  if (!symbols.length) return '';

  const list =
    symbols.length === 1
      ? symbols[0]
      : `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;

  const chainIds = new Set(assets.flatMap(asset => asset.chainIds ?? []));
  const isSingleChain = chainIds.size === 1 && assets.every(asset => asset.chainIds?.length === 1);
  const chainName = isSingleChain ? BRIDGE_TOKENS[[...chainIds][0]]?.name : undefined;

  return chainName ? `${list} on ${chainName}` : list;
};
