import { Token } from '@cryptoalgebra/fuse-sdk';

import { ImageSourcePropType } from 'react-native';
import { base, fuse, mainnet } from 'viem/chains';
import {
  BUSD,
  FUSD_V2,
  FUSD_V3,
  SFUSE,
  USDC,
  USDC_SOLANA,
  USDC_STARGATE,
  USDC_V2,
  USDT,
  USDT_STARGATE,
  USDT_V2,
  VOLT,
  WETH_STARGATE,
  WETH_V2,
  WRAPPED_FUSE,
} from './addresses';
import { ChainsId } from './chains';

import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenMap, TokenType } from '@/lib/types';

export const TOKEN_MAP: TokenMap = {
  [mainnet.id]: [
    {
      name: 'USDC',
      address: ADDRESSES.ethereum.usdc,
      symbol: 'USDC',
      decimals: 6,
      imageId: 'usdc',
    },
  ],
};

/** Symbol for Alchemy price API */
export const NATIVE_TOKENS: Record<number, string> = {
  [mainnet.id]: 'ETH',
  [fuse.id]: 'fuse-network-token',
  [base.id]: 'ETH',
};

/** CoinGecko API coin ids */
export const NATIVE_COINGECKO_TOKENS: Record<number, string> = {
  [mainnet.id]: 'ethereum',
  [fuse.id]: 'fuse-network-token',
  [base.id]: 'ethereum',
};

export const TOKEN_IMAGES: Record<string, ImageSourcePropType> = {
  usdc: getAsset('images/usdc.png'),
  weth: getAsset('images/eth.png'),
  usdt: getAsset('images/usdt.png'),
  usds: getAsset('images/usds.png'),
};

// FUSE CHAIN

export const STABLECOINS_TOKENS = {
  USDT_V2: new Token(ChainsId.Fuse, USDT_V2, 6, 'USDT', 'USDT'),
  USDT: new Token(ChainsId.Fuse, USDT, 6, 'USDT', 'USDT'),
  USDC_V2: new Token(ChainsId.Fuse, USDC_V2, 6, 'USDC V2', 'USD Coin V2'),
  USDC: new Token(ChainsId.Fuse, USDC, 6, 'USDC', 'USDC'),
  USDC_SOLANA: new Token(ChainsId.Fuse, USDC_SOLANA, 6, 'USDC', 'USDC'),
  USDT_STARGATE: new Token(ChainsId.Fuse, USDT_STARGATE, 6, 'USDT', 'USDT'),
  USDC_STARGATE: new Token(ChainsId.Fuse, USDC_STARGATE, 6, 'USDC', 'USDC'),
  FUSD_V2: new Token(ChainsId.Fuse, FUSD_V2, 18, 'fUSD', 'Fuse Dollar V2'),
  FUSD_V3: new Token(ChainsId.Fuse, FUSD_V3, 18, 'fUSD', 'Fuse Dollar V3'),
};

export const WFUSE_TOKEN = new Token(ChainsId.Fuse, WRAPPED_FUSE, 18, 'WFUSE', 'Wrapped FUSE');

export const VOLT_TOKEN = new Token(ChainsId.Fuse, VOLT, 18, 'VOLT', 'Volt');
export const SFUSE_TOKEN = new Token(ChainsId.Fuse, SFUSE, 18, 'sFUSE', 'sFUSE');
export const WETH_V2_TOKEN = new Token(ChainsId.Fuse, WETH_V2, 18, 'WETH V2', 'Wrapped Ether V2');
export const BUSD_TOKEN = new Token(ChainsId.Fuse, BUSD, 18, 'BUSD', 'Binance USD on Fuse');

export const WETH_STARGATE_TOKEN = new Token(
  ChainsId.Fuse,
  WETH_STARGATE,
  18,
  'WETH',
  'Bridged Wrapped Ether (Stargate)',
);
export const USDC_STARGATE_TOKEN = new Token(
  ChainsId.Fuse,
  USDC_STARGATE,
  6,
  'USDCe',
  'USD Coin on Fuse - Stargate',
);
export const soUSDC_TOKEN = new Token(
  ChainsId.Fuse,
  '0x75333830E7014e909535389a6E5b0C02aA62ca27',
  6,
  'soUSDC',
  'Solid USD',
);

export const USDC_TOKEN_BALANCE: TokenBalance = {
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: USDC,
  balance: '0',
  contractDecimals: 6,
  type: TokenType.ERC20,
  chainId: fuse.id,
};
