import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import type {
  RhinoDepositAssetsResponse,
  RhinoDepositRoute,
  RhinoDepositToken,
  RhinoDestinationType,
} from '@/lib/types';

/**
 * `/deposit/rhino/assets` as the backend answers once every route also takes
 * deposits on the chain it pays out on (Base for the wallet, the card and
 * soEURC; Ethereum for soUSD and soETH), and the wallet route carries WBTC.
 * Shared by the tests of every screen that reads it; not a test file itself.
 */

export const rhinoRoute = (
  destinationType: RhinoDestinationType,
  receiveSymbol: string,
  extra: Partial<RhinoDepositRoute> = {},
): RhinoDepositRoute => ({
  destinationType,
  receiveSymbol,
  receiveChainId: base.id,
  minimumUsd: 5,
  maximumUsd: 100000,
  ...extra,
});

export const rhinoToken = (symbol: string, routes: RhinoDepositRoute[]): RhinoDepositToken => ({
  symbol,
  address: '0x0000000000000000000000000000000000000002',
  routes,
});

/** USDC or USDT: to the wallet and the card as sent, into soUSD as USDC on Ethereum. */
const dollar = (symbol: string) =>
  rhinoToken(symbol, [
    rhinoRoute('WALLET', symbol),
    rhinoRoute('RAIN_CARD', symbol),
    rhinoRoute('PROTOCOL', 'USDC', { vault: 'soUSD', receiveChainId: mainnet.id }),
  ]);

/** ETH: to the wallet as sent, to the card as USDC, into soETH on Ethereum. */
const ether = rhinoToken('ETH', [
  rhinoRoute('WALLET', 'ETH'),
  rhinoRoute('RAIN_CARD', 'USDC'),
  rhinoRoute('PROTOCOL', 'ETH', { vault: 'soETH', receiveChainId: mainnet.id }),
]);

/** EURC is never converted, so it never goes to the card or soUSD. */
const euro = rhinoToken('EURC', [
  rhinoRoute('WALLET', 'EURC'),
  rhinoRoute('PROTOCOL', 'EURC', { vault: 'soEURC' }),
]);

/** WBTC goes to the wallet alone. */
const bitcoin = rhinoToken('WBTC', [rhinoRoute('WALLET', 'WBTC')]);

export const RHINO_ASSETS: RhinoDepositAssetsResponse = {
  enabled: true,
  chains: [
    {
      chain: 'ETHEREUM',
      chainId: mainnet.id,
      name: 'Ethereum',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether, euro, bitcoin],
    },
    {
      chain: 'MATIC_POS',
      chainId: polygon.id,
      name: 'Polygon PoS',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT')],
    },
    {
      chain: 'BASE',
      chainId: base.id,
      name: 'Base',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether, euro, bitcoin],
    },
    {
      chain: 'ARBITRUM',
      chainId: arbitrum.id,
      name: 'Arbitrum One',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether],
    },
    {
      chain: 'OPTIMISM',
      chainId: optimism.id,
      name: 'Optimism',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether],
    },
    {
      chain: 'BINANCE',
      chainId: bsc.id,
      name: 'BNB Smart Chain',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether, bitcoin],
    },
    {
      // Not something the backend lists; here to show Fuse stays our own.
      chain: 'FUSE',
      chainId: fuse.id,
      name: 'Fuse',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT')],
    },
    {
      chain: 'TRON',
      name: 'Tron',
      addressType: 'TRON',
      tokens: [dollar('USDT')],
    },
  ],
};
