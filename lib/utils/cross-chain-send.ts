import { formatUnits } from 'viem';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { AssetPath } from '@/lib/assets';
import { TokenBalance } from '@/lib/types';
import {
  CrossChainSendExchangeConfig,
  CrossChainSendNetworkConfig,
  CrossChainSendToken,
} from '@/lib/types/cross-chain-send';
import { formatNumber } from '@/lib/utils/utils';

/** Fuse decimals of both bridgeable stablecoins. */
export const CROSS_CHAIN_SEND_DECIMALS = 6;

export const OWN_WALLET_EXCHANGE = 'own_wallet';
export const OTHER_EXCHANGE = 'other_exchange';

/**
 * The display symbol the bridge uses for a Fuse token, or null when the token
 * has no Stargate route (every token but USDC.e and USDT on Fuse).
 */
export const getCrossChainSendToken = (
  token: Pick<TokenBalance, 'contractAddress' | 'chainId'> | null | undefined,
): CrossChainSendToken | null => {
  if (!token || token.chainId !== fuse.id) return null;
  const address = token.contractAddress?.toLowerCase();
  if (address === USDC_STARGATE.toLowerCase()) return 'USDC';
  if (address === USDT_STARGATE.toLowerCase()) return 'USDT';
  return null;
};

export const isCrossChainSendToken = (token: TokenBalance | null | undefined): boolean =>
  getCrossChainSendToken(token) !== null;

/** Base-unit string (6 decimals) → "1,234.56". */
export const formatLD = (amountLD: string | undefined | null, maximumFractionDigits = 2) => {
  if (!amountLD) return '0';
  try {
    return formatNumber(
      Number(formatUnits(BigInt(amountLD), CROSS_CHAIN_SEND_DECIMALS)),
      maximumFractionDigits,
    );
  } catch {
    return '0';
  }
};

export const NETWORK_ICONS: Record<CrossChainSendNetworkConfig['key'], AssetPath> = {
  arbitrum: 'images/arbitrum.png',
  base: 'images/base.png',
  bsc: 'images/bsc.png',
  ethereum: 'images/eth.png',
  polygon: 'images/polygon.png',
  fuse: 'images/fuse.png',
};

/**
 * Static name/icon lookup for places that show a past send (the activity
 * detail) and shouldn't fetch the config just to label a chain id.
 */
export const CROSS_CHAIN_NETWORKS: Record<
  number,
  { key: CrossChainSendNetworkConfig['key']; name: string }
> = {
  [mainnet.id]: { key: 'ethereum', name: 'Ethereum' },
  [arbitrum.id]: { key: 'arbitrum', name: 'Arbitrum' },
  [base.id]: { key: 'base', name: 'Base' },
  [bsc.id]: { key: 'bsc', name: 'BNB Chain' },
  [polygon.id]: { key: 'polygon', name: 'Polygon' },
  [fuse.id]: { key: 'fuse', name: 'Fuse' },
};

export const isOwnWallet = (exchange: string | null | undefined) =>
  exchange === OWN_WALLET_EXCHANGE;

/** "Binance", "My own wallet", or the raw id when the config doesn't know it. */
export const getExchangeDisplayName = (
  exchange: CrossChainSendExchangeConfig | null | undefined,
  exchangeId: string | null | undefined,
) => {
  if (isOwnWallet(exchangeId)) return 'My own wallet';
  return exchange?.name ?? exchangeId ?? '';
};

/** The letter avatar initial: the exchange's initial, "W" for the user's own wallet. */
export const getExchangeInitial = (
  exchange: CrossChainSendExchangeConfig | null | undefined,
  exchangeId: string | null | undefined,
) => {
  if (isOwnWallet(exchangeId)) return 'W';
  const name = exchange?.name ?? exchangeId ?? '';
  return name.charAt(0).toUpperCase() || '?';
};

/** `Arrives as Binance-Peg USDC`, or `Native USDC` when that's already the wording. */
export const describeReceivesAs = (receivesAs: string | undefined, token: CrossChainSendToken) => {
  if (!receivesAs) return `Arrives as ${token}`;
  if (receivesAs.startsWith('Native')) return receivesAs;
  return `Arrives as ${receivesAs}`;
};
