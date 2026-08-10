import { ImageSourcePropType } from 'react-native';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';

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

/** Stablecoins offered by the card's direct-deposit flow. */
export const CARD_FUND_TOKENS: CardFundToken[] = [
  { symbol: 'USDC', icon: getAsset('images/deposit-crypto-usdc.png') },
  { symbol: 'USDT', icon: getAsset('images/deposit-crypto-usdt.png') },
];

export const CARD_FUND_USD_ICON = getAsset('images/deposit-cash-us.png');

/** Deposits land on the card wallet within roughly the same window on every chain. */
export const CARD_FUND_ESTIMATED_TIME = '~3 min';

export const CARD_FUND_LEARN_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

export const getCardFundTokenIcon = (symbol: string): ImageSourcePropType =>
  CARD_FUND_TOKENS.find(token => token.symbol === symbol)?.icon ?? CARD_FUND_TOKENS[0].icon;

/** Chains that can receive a direct deposit of `symbol`, in display order. */
export const getCardFundNetworks = (symbol: string): CardFundNetwork[] => {
  const depositConfig = getVaultDepositConfig();

  return Object.entries(BRIDGE_TOKENS)
    .map(([id, chain]) => ({ chainId: Number(id), chain }))
    .filter(({ chainId }) => depositConfig.supportedChains.includes(chainId))
    .filter(({ chainId }) => getAllowedTokensForChain(chainId).includes(symbol))
    .sort((a, b) => a.chain.sort - b.chain.sort)
    .map(({ chainId, chain }) => ({
      chainId,
      name: chain.name,
      icon: chain.icon,
      isComingSoon: chain.isComingSoon,
    }));
};

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
