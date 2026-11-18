import type { SpendAssetKey } from '@/lib/utils/spendOrder';

/**
 * How each asset reads in an order screen's preview: its name in the breakdown and its colour in
 * the bar. Shared by the Spend order and Collateral order previews, whose keys are the same
 * (collateral keys are a subset of the spend keys).
 */
export const PREVIEW_ASSET_LABEL: Record<SpendAssetKey, string> = {
  USDC: 'USDC',
  USDT: 'USDT',
  USD_YIELD: 'USD Yield',
  EURC: 'EURC',
  EUR_YIELD: 'EUR Yield',
  BTC: 'Bitcoin',
  BTC_YIELD: 'BTC Yield',
  WBTC: 'Wrapped Bitcoin',
  ETH: 'Ethereum',
  ETH_YIELD: 'ETH Yield',
  SOL: 'Solana',
  AAVE: 'Aave',
  ZEC: 'Zcash',
};

/** Figma 30971:15324: USDC, USDT and USD Yield are drawn; the rest follow their own brand colours. */
export const PREVIEW_ASSET_COLOR: Record<SpendAssetKey, string> = {
  USDC: '#2775CA',
  USDT: '#26A17B',
  USD_YIELD: '#94F27F',
  EURC: '#2775CA',
  EUR_YIELD: '#7FB2F2',
  BTC: '#F7931A',
  // Not drawn in Figma: Bitcoin's orange, paler for the yield share as EUR and ETH Yield are, and
  // deeper for the wrapped coin, so the three read apart in one bar.
  BTC_YIELD: '#FBC77A',
  WBTC: '#C4701A',
  ETH: '#8A92B2',
  ETH_YIELD: '#C3C9E0',
  SOL: '#9945FF',
  AAVE: '#B6509E',
  ZEC: '#F4B728',
};

/** Solid's yield shares: they keep earning while they back the card. */
export const PREVIEW_YIELD_KEYS: readonly SpendAssetKey[] = [
  'USD_YIELD',
  'EUR_YIELD',
  'ETH_YIELD',
  'BTC_YIELD',
];

/** The asset's name, or the key itself for one this build does not know. */
export const previewAssetLabel = (asset: string): string =>
  PREVIEW_ASSET_LABEL[asset as SpendAssetKey] ?? asset;

/** The asset's colour, or white for one this build does not know. */
export const previewAssetColor = (asset: string): string =>
  PREVIEW_ASSET_COLOR[asset as SpendAssetKey] ?? '#FFFFFF';

export const isPreviewYieldKey = (asset: string): boolean =>
  PREVIEW_YIELD_KEYS.includes(asset as SpendAssetKey);
