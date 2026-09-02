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

/**
 * The direct-deposit destination that selects the *card* deposit address.
 *
 * Named for Rain because Rain was the only issuer when the address was first
 * derived, and its salt — and so every address already handed out — has to stay
 * exactly as it was. A Wirex cardholder deposits to the same address; the
 * backend resolves the issuer and delivers the funds to the Rain card on Base
 * or to the cardholder's Safe on Fuse accordingly.
 */
export const CARD_FUND_DESTINATION_TYPE = 'RAIN_CARD' as const;

/**
 * Which groups the "Fund your card" step shows.
 *
 * Configuration rather than a prop per row, because what differs between the two
 * issuers is only *which* methods are wired up, not how the screen works. Wirex
 * cards launch with the stablecoin rows alone; the rest are switched on here as
 * their backend legs land, so enabling one is a one-line change instead of a
 * second copy of the options screen.
 */
export type CardFundSections = {
  stablecoins: boolean;
  /** USD (ACH / Wire) — the virtual-account flow. */
  cashDeposit: boolean;
  /** BRL, BDT, MXN, PHP — the buy-crypto onramp. */
  localCurrencies: boolean;
  /** "Move from wallet or savings". */
  moveFromSolid: boolean;
  /** "Deposit from an external wallet". */
  externalWallet: boolean;
};

/** Rain cards offer every funding method. */
export const RAIN_CARD_FUND_SECTIONS: CardFundSections = {
  stablecoins: true,
  cashDeposit: true,
  localCurrencies: true,
  moveFromSolid: true,
  externalWallet: true,
};

/**
 * Wirex cards offer direct stablecoin deposits and the local-currency onramp.
 *
 * Local currencies work because the onramp needs no Fuse leg of its own: TransFi
 * has no USDC-on-Fuse entry, so the backend points the delivery at the same card
 * deposit address the stablecoin rows hand out, and the direct-deposit pipeline
 * carries it to the Safe on Fuse from there.
 *
 * The rest are not conceptually impossible for Wirex — they all end in the same
 * place, spendable stablecoin in the cardholder's Safe on Fuse — but each needs
 * its own backend leg pointed at Fuse first. They stay off here until that
 * lands, rather than being offered and then failing with no destination.
 */
export const WIREX_CARD_FUND_SECTIONS: CardFundSections = {
  stablecoins: true,
  cashDeposit: false,
  localCurrencies: true,
  moveFromSolid: false,
  externalWallet: false,
};
