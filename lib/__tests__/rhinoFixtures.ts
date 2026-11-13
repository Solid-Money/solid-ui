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
 * taken on Ethereum, and USDT goes everywhere as USDC (rhino.fi cannot pay USDT
 * out on Base for us) - except sent on Base, where only soUSD takes it: the
 * wallet and the card keep Base USDT for our own pipeline. Beside the app's own
 * chains, a few it has no row for ("More networks"), Arc among them. Shared by
 * the tests of every screen that reads it; not a test file itself.
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

/** USDT: to the wallet and the card as USDC, into soUSD. */
const usdt = rhinoToken('USDT', [
  rhinoRoute('WALLET', 'USDC'),
  rhinoRoute('RAIN_CARD', 'USDC'),
  soUsd,
]);

/** USDT sent on Base: into soUSD alone. The wallet and the card keep it for our own pipeline. */
const usdtOnBase = rhinoToken('USDT', [soUsd]);

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
      tokens: [dollar('USDC'), usdtOnBase, ether, euro, bitcoin],
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
      // A chain the app has no row of its own for: listed under "More networks".
      chain: 'ARC',
      chainId: 5042,
      name: 'Arc',
      addressType: 'EVM',
      tokens: [dollar('USDC'), euro],
    },
  ],
};

/**
 * The same answer from a backend that also lists USDT sent on Base to the
 * wallet and the card: what our own pipeline has to win over there.
 */
export const RHINO_ASSETS_WITH_BASE_USDT_ROUTES: RhinoDepositAssetsResponse = {
  ...RHINO_ASSETS,
  chains: RHINO_ASSETS.chains.map(chain =>
    chain.chain === 'BASE'
      ? { ...chain, tokens: chain.tokens.map(token => (token.symbol === 'USDT' ? usdt : token)) }
      : chain,
  ),
};

/** Native BTC, sent on Bitcoin: WBTC to the Safe on Base, USDC to the card. */
const nativeBitcoin: RhinoDepositToken = {
  symbol: 'BTC',
  address: '0x0000000000000000000000000000000000000000',
  routes: [
    rhinoRoute('WALLET', 'WBTC', { minimumUsd: 10, maximumUsd: 50000 }),
    rhinoRoute('RAIN_CARD', 'USDC', { minimumUsd: 10, maximumUsd: 50000 }),
  ],
};

/**
 * The same answer from a backend with Bitcoin switched on: native BTC, which
 * no chain of the app's own carries, listed after Solana as the backend does.
 */
export const RHINO_ASSETS_WITH_BITCOIN: RhinoDepositAssetsResponse = {
  ...RHINO_ASSETS,
  chains: RHINO_ASSETS.chains.flatMap(chain =>
    chain.chain === 'SOLANA'
      ? [
          chain,
          {
            chain: 'BITCOIN',
            name: 'Bitcoin',
            addressType: 'BTC' as const,
            tokens: [nativeBitcoin],
          },
        ]
      : [chain],
  ),
};
