import { base, fuse } from 'viem/chains';

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
  /**
   * A limit on which purchases this asset pays for, for the tooltip — "for euro purchases".
   *
   * Only for an asset the card draws on conditionally. EURC on Base pays euro purchases only:
   * anything else is routed to Fuse, so without this the sentence would promise the user their
   * EURC covers a purchase in dollars.
   */
  qualifier?: string;
}

/**
 * What a card with no balance of its own can spend, and therefore what the
 * "Spendable" row in the home balance breakdown adds up.
 *
 * USDC, USDT and soUSD on Fuse, in the order the backend actually draws from them.
 * A Wirex purchase is paid by Wirex out of its own Master Account and reimbursed by
 * debiting the user's Safe on Fuse through `SolidCashModule` at settlement, so any of
 * these held on another chain is not reachable and is deliberately left out —
 * counting it would show the user spending power they do not have. The one
 * exception is EURC on Base once euro spending is enabled — see
 * {@link baseEurcSpendableAsset}.
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
 * EURC on Base, for a cardholder who has enabled euro spending.
 *
 * Not in {@link CARD_SPENDABLE_ASSETS}, because it is not spendable for everyone: the Base
 * instance has to be enabled first, and until it is, counting EURC would quote spending power
 * the card declines. `cardSpendableAssetsFor` adds it once the backend records the enablement.
 *
 * The address is passed in rather than read from config, so the backend's allowlist for the
 * instance decides it — the same reason every entry above is matched on address.
 */
export const baseEurcSpendableAsset = (addresses: string[]): CardSpendableAsset => ({
  symbol: 'EURC',
  chainIds: [base.id],
  addresses: addresses.map(address => address.toLowerCase()),
  qualifier: 'for euro purchases',
});

/**
 * Everything the Base instance spends, as named entries: EURC, and soEUR once the instance
 * allowlists it.
 *
 * The backend serves the instance's spend tokens as one list. Read as one EURC entry, soEUR on it
 * was described to the cardholder as EURC; this names each by address, soEUR by this build's soEUR
 * vault, and keeps every other address under EURC as before.
 */
export const baseSpendableAssets = (addresses: string[]): CardSpendableAsset[] => {
  const soEur = ADDRESSES.base.soEurcVault.toLowerCase();
  const lower = addresses.map(address => address.toLowerCase());
  const eurc = lower.filter(address => address !== soEur);

  return [
    ...(eurc.length ? [baseEurcSpendableAsset(eurc)] : []),
    ...(lower.includes(soEur)
      ? [
          {
            symbol: 'soEUR',
            chainIds: [base.id],
            addresses: [soEur],
            qualifier: 'for euro purchases',
          },
        ]
      : []),
  ];
};

const joinWithAnd = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

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
 * Grouped by network, so a list spanning two chains still says where each asset is
 * spent from — "USDC, USDT and soUSD on Fuse and EURC on Base for euro purchases".
 * An entry with no `chainIds`, or with more than one, contributes its symbol and no
 * network clause: the settlement mechanism is chain-bound, so such an entry would be
 * a change worth writing copy for rather than one to interpolate blindly.
 */
export const describeCardSpendableAssets = (
  assets: CardSpendableAsset[] = CARD_SPENDABLE_ASSETS,
): string => {
  const groups = new Map<string, { symbols: string[]; chainName?: string; qualifier?: string }>();

  for (const asset of assets) {
    if (!asset.symbol) continue;

    const chainId = asset.chainIds?.length === 1 ? asset.chainIds[0] : undefined;
    const key = `${chainId ?? ''}|${asset.qualifier ?? ''}`;
    const group = groups.get(key) ?? {
      symbols: [],
      chainName: chainId !== undefined ? BRIDGE_TOKENS[chainId]?.name : undefined,
      qualifier: asset.qualifier,
    };

    group.symbols.push(asset.symbol);
    groups.set(key, group);
  }

  return joinWithAnd(
    [...groups.values()].map(group =>
      [joinWithAnd(group.symbols), group.chainName && `on ${group.chainName}`, group.qualifier]
        .filter(Boolean)
        .join(' '),
    ),
  );
};
