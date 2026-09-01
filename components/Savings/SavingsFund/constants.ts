import { ImageSourcePropType } from 'react-native';
import { arbitrum, base, fuse, mainnet } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { getAsset } from '@/lib/assets';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';

import type { SavingsFundIntent } from '@/lib/types';

export type SavingsFundToken = {
  symbol: string;
  /** Share token minted for this deposit — shown as the row's subtitle. */
  vaultToken: string;
  icon: ImageSourcePropType;
  /**
   * Chains this token can be sent from. Left undefined for the stablecoins,
   * which follow the vault config's supported chains; native assets list their
   * own chains because they are only bridgeable from where they exist.
   */
  chainIds?: number[];
};

export type SavingsFundNetwork = {
  chainId: number;
  name: string;
  icon: ImageSourcePropType;
  isComingSoon?: boolean;
};

/**
 * What a savings direct deposit accepts, grouped as the design shows it.
 *
 * Each token maps to the vault it funds — USDC/USDT mint soUSD, ETH mints soETH,
 * FUSE mints soFUSE — which is resolved on the backend from the token that
 * actually lands, so this list only decides what the UI advertises.
 */
export const SAVINGS_FUND_STABLECOINS: SavingsFundToken[] = [
  {
    symbol: 'USDC',
    vaultToken: 'soUSD',
    icon: getAsset('images/deposit-crypto-usdc.png'),
  },
  {
    symbol: 'USDT',
    vaultToken: 'soUSD',
    icon: getAsset('images/deposit-crypto-usdt.png'),
  },
];

export const SAVINGS_FUND_CRYPTO: SavingsFundToken[] = [
  {
    symbol: 'ETH',
    vaultToken: 'soETH',
    icon: getAsset('images/eth.png'),
    // ETH is bridged to Ethereum before it is deposited, so it can be sent from
    // any chain whose native currency is ETH.
    chainIds: [mainnet.id, base.id, arbitrum.id],
  },
  {
    symbol: 'WFUSE',
    vaultToken: 'soFUSE',
    icon: getAsset('images/wfuse.png'),
    // The soFUSE teller lives on Fuse and takes WFUSE; native FUSE sent to the
    // address still works (the backend wraps it) but is not advertised here.
    chainIds: [fuse.id],
  },
];

export const SAVINGS_FUND_TOKENS: SavingsFundToken[] = [
  ...SAVINGS_FUND_STABLECOINS,
  ...SAVINGS_FUND_CRYPTO,
];

/**
 * The token groups a savings direct deposit offers, for the flow's intent.
 *
 * `card_deposit` is the card's "Deposit at least $5" gate, which completes off
 * the soUSD balance alone — so it offers only the stablecoins that mint soUSD.
 * Were ETH or WFUSE on offer there, a user could deposit the full $5, fund
 * soETH / soFUSE instead, and leave the step stuck at "not met" with nothing
 * on screen explaining why.
 */
export const getSavingsFundTokenGroups = (
  intent: SavingsFundIntent,
): { stablecoins: SavingsFundToken[]; crypto: SavingsFundToken[] } => ({
  stablecoins: SAVINGS_FUND_STABLECOINS,
  crypto: intent === 'card_deposit' ? [] : SAVINGS_FUND_CRYPTO,
});

/** Deposits are credited within roughly this window on every supported chain. */
export const SAVINGS_FUND_ESTIMATED_TIME = '~3 min';

export const SAVINGS_FUND_LEARN_URL =
  'https://support.solid.xyz/en/articles/14431132-supported-networks-and-tokens-on-solid';

export const getSavingsFundToken = (symbol: string): SavingsFundToken =>
  SAVINGS_FUND_TOKENS.find(token => token.symbol === symbol) ?? SAVINGS_FUND_TOKENS[0];

export const getSavingsFundTokenIcon = (symbol: string): ImageSourcePropType =>
  getSavingsFundToken(symbol).icon;

/** Chains that can receive a savings direct deposit of `symbol`, in display order. */
export const getSavingsFundNetworks = (symbol: string): SavingsFundNetwork[] => {
  const token = SAVINGS_FUND_TOKENS.find(entry => entry.symbol === symbol);
  const depositConfig = getVaultDepositConfig();

  return Object.entries(BRIDGE_TOKENS)
    .map(([id, chain]) => ({ chainId: Number(id), chain }))
    .filter(({ chainId }) =>
      token?.chainIds
        ? token.chainIds.includes(chainId)
        : depositConfig.supportedChains.includes(chainId) &&
          getAllowedTokensForChain(chainId).includes(symbol),
    )
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
export const getSavingsFundNetworkChips = (symbol: string): string[] => {
  const networks = getSavingsFundNetworks(symbol);
  const visible = networks.slice(0, 2).map(network => network.name);
  const remaining = networks.length - visible.length;

  return remaining > 0 ? [...visible, `+${remaining}`] : visible;
};
