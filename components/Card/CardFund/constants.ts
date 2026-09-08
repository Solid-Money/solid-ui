import { ImageSourcePropType } from 'react-native';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';
import { CARD_FUND_TOKEN_SYMBOLS, getCardFundChains } from '@/lib/utils/cardFunding';

// What the flow offers and accepts lives in its own leaf module so it is unit
// testable (this file's import graph pulls `lib/assets`, which does not load
// under jest-expo). Re-exported here so `@/components/Card/CardFund/constants`
// stays the single import path for the funding screens.
export type { CardFundSections } from '@/lib/utils/cardFunding';
export {
  CARD_FUND_DESTINATION_TYPE,
  CARD_FUND_MOVE_COPY,
  CARD_FUND_TOKEN_SYMBOLS,
  getCardFundChains,
  getCardFundRoutes,
  getCardFundRoutesTooltip,
  getCardFundSupportedNetworkNames,
  RAIN_CARD_FUND_SECTIONS,
  WIREX_CARD_FUND_SECTIONS,
} from '@/lib/utils/cardFunding';

export type CardFundToken = {
  symbol: string;
  icon: ImageSourcePropType;
};

export type CardFundNetwork = {
  chainId: number;
  name: string;
  icon: ImageSourcePropType;
  isComingSoon?: boolean;
};

/**
 * Stablecoins offered by the card's direct-deposit flow, with their row icons.
 *
 * The symbols come from `CARD_FUND_TOKEN_SYMBOLS` so the rows shown and the
 * routes offered are the same list — a token with an icon here but no entry
 * there would be a row whose deposits nothing accepts.
 */
export const CARD_FUND_TOKEN_ICONS: Record<string, ImageSourcePropType> = {
  USDC: getAsset('images/deposit-crypto-usdc.png'),
  USDT: getAsset('images/deposit-crypto-usdt.png'),
};

export const CARD_FUND_TOKENS: CardFundToken[] = CARD_FUND_TOKEN_SYMBOLS.map(symbol => ({
  symbol,
  icon: CARD_FUND_TOKEN_ICONS[symbol],
}));

export const CARD_FUND_USD_ICON = getAsset('images/deposit-cash-us.png');

/**
 * Cash-deposit rows shown before the "Show more" footer takes over. The list of
 * local currencies grows as onramp corridors are added, so the group is capped
 * to keep the first screen of "Fund your card" scannable — every method is
 * still one tap away behind the footer.
 */
export const CARD_FUND_CASH_DEPOSIT_VISIBLE_ROWS = 4;

/** Deposits land on the card wallet within roughly the same window on every chain. */
export const CARD_FUND_ESTIMATED_TIME = '~3 min';

export const CARD_FUND_LEARN_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

export const getCardFundTokenIcon = (symbol: string): ImageSourcePropType =>
  CARD_FUND_TOKENS.find(token => token.symbol === symbol)?.icon ?? CARD_FUND_TOKENS[0].icon;

/**
 * Chains that can receive a direct deposit of `symbol`, in display order, each
 * with its icon.
 *
 * The routing itself lives in `cardFunding`, where it is unit testable; this only
 * dresses that answer for display.
 */
export const getCardFundNetworks = (symbol: string): CardFundNetwork[] =>
  getCardFundChains(symbol).map(chain => ({
    ...chain,
    icon: BRIDGE_TOKENS[chain.chainId].icon,
  }));

/**
 * Chips shown on a token row: the first two networks plus a "+N" overflow, so
 * the row stays one line regardless of how many chains are supported.
 */
export const getCardFundNetworkChips = (symbol: string): string[] => {
  const networks = getCardFundNetworks(symbol);
  const visible = networks.slice(0, 2).map(network => network.name);
  const remaining = networks.length - visible.length;

  return remaining > 0 ? [...visible, `+${remaining}`] : visible;
};
