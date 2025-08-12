import { Address } from 'viem';

export interface TokenListItem {
  name: string;
  address: Address;
  symbol: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}
