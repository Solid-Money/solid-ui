export type StockCategory = 'trending' | 'tech' | 'etf' | 'energy';

export type Stock = {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  category: StockCategory[];
  logoColor: string;
  sparklineTrend: 'up' | 'down';
  // On-chain token address on Base (Backed Finance tokenized stock)
  // TODO: replace with actual deployed contract addresses
  contractAddress?: `0x${string}`;
};

export type Holding = {
  ticker: string;
  name: string;
  shares: number;
  changePercent: number;
  logoColor: string;
  avgCost: number;
  contractAddress?: `0x${string}`;
};

// Contract addresses for Backed Finance tokenized stocks on Base (chain ID 8453).
// These are ERC-20 tokens swappable via CoW Protocol.
// TODO: replace placeholder addresses below with actual deployed contract addresses
// from https://backed.fi or Backed Finance documentation.
export const STOCKS: Stock[] = [
  {
    ticker: 'AAPLx',
    name: 'Apple Inc.',
    price: 194.23,
    changePercent: 1.11,
    category: ['trending', 'tech'],
    logoColor: '#4A4A4A',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bAAPL address on Base
  },
  {
    ticker: 'TSLAx',
    name: 'Tesla, Inc.',
    price: 176.4,
    changePercent: -0.85,
    category: ['trending', 'tech'],
    logoColor: '#CC0000',
    sparklineTrend: 'down',
    contractAddress: undefined, // TODO: add Backed bTSLA address on Base
  },
  {
    ticker: 'SPYx',
    name: 'S&P 500 ETF',
    price: 512.44,
    changePercent: 0.42,
    category: ['trending', 'etf'],
    logoColor: '#1A6FBB',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bSPY address on Base
  },
  {
    ticker: 'MSFTx',
    name: 'Microsoft',
    price: 422.86,
    changePercent: 1.24,
    category: ['trending', 'tech'],
    logoColor: '#0078D4',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bMSFT address on Base
  },
  {
    ticker: 'NVDAx',
    name: 'Nvidia Corp.',
    price: 875.22,
    changePercent: 3.24,
    category: ['trending', 'tech'],
    logoColor: '#76B900',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bNVDA address on Base
  },
  {
    ticker: 'AMZNx',
    name: 'Amazon.com',
    price: 178.12,
    changePercent: 0.12,
    category: ['trending', 'tech'],
    logoColor: '#FF9900',
    sparklineTrend: 'down',
    contractAddress: undefined, // TODO: add Backed bAMZN address on Base
  },
  {
    ticker: 'GOOGLx',
    name: 'Alphabet Inc.',
    price: 174.18,
    changePercent: 0.67,
    category: ['tech'],
    logoColor: '#4285F4',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bGOOGL address on Base
  },
  {
    ticker: 'METAx',
    name: 'Meta Platforms',
    price: 492.5,
    changePercent: 1.42,
    category: ['tech'],
    logoColor: '#0866FF',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bMETA address on Base
  },
  {
    ticker: 'QQQx',
    name: 'Nasdaq-100 ETF',
    price: 456.32,
    changePercent: -0.31,
    category: ['etf'],
    logoColor: '#5B21B6',
    sparklineTrend: 'down',
    contractAddress: undefined, // TODO: add Backed bQQQ address on Base
  },
  {
    ticker: 'XOMx',
    name: 'ExxonMobil',
    price: 112.44,
    changePercent: 0.88,
    category: ['energy'],
    logoColor: '#D62828',
    sparklineTrend: 'up',
    contractAddress: undefined, // TODO: add Backed bXOM address on Base
  },
];

export const MOCK_HOLDINGS: Holding[] = [
  {
    ticker: 'AAPLx',
    name: 'Apple Inc.',
    shares: 1.24,
    changePercent: 1.2,
    logoColor: '#4A4A4A',
    avgCost: 188.4,
    contractAddress: STOCKS.find(s => s.ticker === 'AAPLx')?.contractAddress,
  },
  {
    ticker: 'TSLAx',
    name: 'Tesla, Inc.',
    shares: 0.8,
    changePercent: -0.8,
    logoColor: '#CC0000',
    avgCost: 180.0,
    contractAddress: STOCKS.find(s => s.ticker === 'TSLAx')?.contractAddress,
  },
  {
    ticker: 'SPYx',
    name: 'S&P 500 ETF',
    shares: 4.5,
    changePercent: 0.4,
    logoColor: '#1A6FBB',
    avgCost: 505.0,
    contractAddress: STOCKS.find(s => s.ticker === 'SPYx')?.contractAddress,
  },
];

export const MOCK_PORTFOLIO_VALUE = 3847.2;
export const MOCK_PORTFOLIO_CHANGE = 42.8;
export const MOCK_PORTFOLIO_CHANGE_PCT = 1.13;

export function formatPrice(price: number): string {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatChangePercent(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
