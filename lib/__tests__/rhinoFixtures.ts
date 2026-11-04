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
 * soEURC; Ethereum for soUSD and soETH), the wallet route carries WBTC, EURC is
 * taken on Ethereum, and USDT is listed into soUSD alone: no wallet or card
 * route takes it, since rhino.fi cannot deliver it on Base. Beside the app's
 * own chains, a few it has no row for ("More networks"), Arc among them.
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

/** Into soUSD as USDC on Ethereum. */
const soUsd = rhinoRoute('PROTOCOL', 'USDC', { vault: 'soUSD', receiveChainId: mainnet.id });

/** USDC: to the wallet and the card as sent, into soUSD. */
const usdc = rhinoToken('USDC', [
  rhinoRoute('WALLET', 'USDC'),
  rhinoRoute('RAIN_CARD', 'USDC'),
  soUsd,
]);

/** USDT: into soUSD alone. rhino.fi cannot deliver it on Base, where the wallet and card are. */
const usdt = rhinoToken('USDT', [soUsd]);

/**
 * USDT as the backend listed it before it dropped USDT's wallet and card
 * routes: what our own pipeline has to win over, should it list them again.
 */
export const RHINO_USDT_EVERYWHERE = rhinoToken('USDT', [
  rhinoRoute('WALLET', 'USDT'),
  rhinoRoute('RAIN_CARD', 'USDT'),
  soUsd,
]);

const dollar = (symbol: string) => (symbol === 'USDT' ? usdt : usdc);

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
    {
      chain: 'SOLANA',
      name: 'Solana',
      addressType: 'SOL',
      tokens: [dollar('USDC'), dollar('USDT'), euro],
    },
    {
      chain: 'AVALANCHE',
      chainId: 43114,
      name: 'Avalanche',
      addressType: 'EVM',
      tokens: [dollar('USDC'), dollar('USDT'), ether, bitcoin],
    },
    {
      // Listed by the backend, held back from "More networks" by the app.
      chain: 'ARC',
      chainId: 5042,
      name: 'Arc',
      addressType: 'EVM',
      tokens: [dollar('USDC'), euro],
    },
  ],
};

/** The same answer from a backend that still lists USDT to the wallet and the card. */
export const RHINO_ASSETS_WITH_USDT_ROUTES: RhinoDepositAssetsResponse = {
  ...RHINO_ASSETS,
  chains: RHINO_ASSETS.chains.map(chain => ({
    ...chain,
    tokens: chain.tokens.map(token => (token.symbol === 'USDT' ? RHINO_USDT_EVERYWHERE : token)),
  })),
};
