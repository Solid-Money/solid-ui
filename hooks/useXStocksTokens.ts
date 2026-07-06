import { XSTOCKS_TOKENS } from '@/constants/xstocksTokens';

export type XStockToken = {
  symbol: string;
  name: string;
  contractAddress: `0x${string}`;
  logoUrl: string;
};

// TODO: replace with a backend-proxied endpoint once available (xstocks API has CORS restrictions).
export function useXStocksTokens() {
  return { tokens: XSTOCKS_TOKENS, isLoading: false, error: null };
}
