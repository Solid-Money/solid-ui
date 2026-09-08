import { XStockToken } from '@/hooks/useXStocksTokens';

export type EarnCategoryKey = 'popular' | 'tech' | 'etf' | 'metals';

export const EARN_CATEGORIES: { key: EarnCategoryKey; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'tech', label: 'Tech' },
  { key: 'etf', label: 'ETFs' },
  { key: 'metals', label: 'Metals' },
];

/**
 * Curated, ordered picks per category. Order is the display order — the Earn
 * page only previews the first few, so the strongest names lead each list.
 */
const CATEGORY_TICKERS: Record<EarnCategoryKey, string[]> = {
  popular: ['TSLAx', 'SPCXx', 'SPYx', 'NVDAx', 'VTIx', 'AAPLx', 'COINx', 'PLTRx'],
  tech: ['AAPLx', 'NVDAx', 'MSFTx', 'GOOGLx', 'METAx', 'AMZNx', 'AMDx', 'AVGOx'],
  etf: ['SPYx', 'QQQx', 'VTIx', 'VOOx', 'IWMx', 'SMHx', 'SGOVx', 'IEMGx'],
  metals: ['GLDx', 'SLVx', 'PPLTx', 'PALLx', 'GDXx', 'COPXx', 'URAx'],
};

/**
 * Sector caption shown under each name. Kept explicit rather than derived from
 * the token name so the list reads like a brokerage screen instead of repeating
 * the issuer's "… xStock" naming.
 */
const SECTOR_BY_TICKER: Record<string, string> = {
  AAPLx: 'Equity · Consumer tech',
  AMDx: 'Equity · Semis',
  AMZNx: 'Equity · E-commerce',
  AVGOx: 'Equity · Semis',
  COINx: 'Equity · Crypto',
  COPXx: 'Metals · Copper miners',
  GDXx: 'Metals · Gold miners',
  GLDx: 'Metals · Gold',
  GOOGLx: 'Equity · Internet',
  IEMGx: 'Index · Emerging markets',
  IWMx: 'Index · Small cap',
  METAx: 'Equity · Social',
  MSFTx: 'Equity · Software',
  NVDAx: 'Equity · Semis',
  PALLx: 'Metals · Palladium',
  PLTRx: 'Equity · Software',
  PPLTx: 'Metals · Platinum',
  QQQx: 'Index · Nasdaq-100',
  SGOVx: 'Index · Treasuries',
  SLVx: 'Metals · Silver',
  SMHx: 'Index · Semis',
  SPCXx: 'Equity · Space',
  SPYx: 'Index · S&P 500',
  TSLAx: 'Equity · Auto',
  URAx: 'Metals · Uranium',
  VOOx: 'Index · S&P 500',
  VTIx: 'Index · Total market',
};

const DEFAULT_SECTOR = 'Tokenized equity';

/**
 * Display names for tickers whose issuer name reads badly in a list — either
 * because it is the fund house rather than the fund ("Vanguard" for VTI) or
 * because it is the full legal name ("abrdn Physical Palladium Shares").
 */
const NAME_OVERRIDES: Record<string, string> = {
  COPXx: 'Copper Miners ETF',
  GDXx: 'Gold Miners ETF',
  IEMGx: 'Emerging Markets ETF',
  IWMx: 'Russell 2000 ETF',
  NVDAx: 'Nvidia',
  PALLx: 'Palladium',
  PPLTx: 'Platinum',
  QQQx: 'Nasdaq-100 ETF',
  SGOVx: 'Treasury Bond ETF',
  SLVx: 'Silver',
  SMHx: 'Semiconductor ETF',
  SPYx: 'S&P 500 ETF',
  URAx: 'Uranium ETF',
  VOOx: 'Vanguard S&P 500',
  VTIx: 'Total Market ETF',
};

/** How many rows the Earn page previews before the "Browse all" CTA. */
export const EARN_PREVIEW_COUNT = 5;

/** "Tesla xStock" → "Tesla" — the wrapper suffix is noise in a list of names. */
export const formatAssetName = (ticker: string, name: string) => {
  const override = NAME_OVERRIDES[ticker];
  if (override) return override;

  return name.replace(/\s*xstock$/i, '').trim() || name;
};

export const getAssetSector = (ticker: string) => SECTOR_BY_TICKER[ticker] ?? DEFAULT_SECTOR;

/**
 * Resolve a category's curated tickers against the tokens we actually have,
 * preserving the curated order and silently dropping anything unlisted so a
 * catalog change can never leave a hole in the row list.
 */
export const selectCategoryTokens = (
  tokens: XStockToken[],
  category: EarnCategoryKey,
  limit = EARN_PREVIEW_COUNT,
): XStockToken[] => {
  const bySymbol = new Map(tokens.map(token => [token.symbol, token]));

  return CATEGORY_TICKERS[category]
    .map(symbol => bySymbol.get(symbol))
    .filter((token): token is XStockToken => !!token)
    .slice(0, limit);
};
