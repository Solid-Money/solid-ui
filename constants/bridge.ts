import { ImageSourcePropType } from 'react-native';
import { NATIVE_TOKEN_ADDRESS } from 'thirdweb';
import { arbitrum, base, baseSepolia, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import { WRAPPED_FUSE } from '@/constants/addresses';

export type BridgeToken = {
  name?: string;
  fullName?: string;
  address: string;
  decimals?: number;
  icon?: ImageSourcePropType;
  version?: string;
  isPermit?: boolean;
  isNative?: boolean;
};

type BridgeTokens = {
  [key in number]: {
    tokens?: Record<string, BridgeToken>;
    name: string;
    icon: ImageSourcePropType;
    sort: number;
    isComingSoon?: boolean;
    bridgeSpeed?: number;
  };
};

export const BRIDGE_TOKENS: BridgeTokens = {
  [mainnet.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        icon: require('@/assets/images/usdc-4x.png'),
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        icon: require('@/assets/images/usdt.png'),
        isPermit: false,
      },
      ETH: {
        name: 'ETH',
        fullName: 'Ether',
        address: '0x0000000000000000000000000000000000000000',
        icon: require('@/assets/images/eth.png'),
        version: '1',
        isPermit: false,
        isNative: true,
      },
      WETH: {
        name: 'WETH',
        fullName: 'Wrapped Ether',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        icon: require('@/assets/images/weth.png'),
        version: '1',
        isPermit: false,
      },
    },
    name: 'Ethereum',
    icon: require('@/assets/images/eth.png'),
    sort: 1,
    bridgeSpeed: 2,
  },
  [polygon.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
    },
    name: 'Polygon',
    icon: require('@/assets/images/polygon.png'),
    sort: 2,
    bridgeSpeed: 2,
  },
  [base.id]: {
    // USDC only. Base USDT is deliberately absent, not missed: every surface that
    // offers a token on a chain reads this map, so listing it here is what would
    // offer it for deposit, bridging and card funding.
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        version: '2',
        isPermit: false,
      },
    },
    name: 'Base',
    icon: require('@/assets/images/base.png'),
    sort: 3,
    bridgeSpeed: 2,
  },
  // [baseSepolia.id]: {
  //   tokens: {
  //     USDC: {
  //       name: 'USDC',
  //       address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  //       version: '2',
  //       isPermit: false,
  //     },
  //   },
  //   name: 'Base Sepolia',
  //   icon: require('@/assets/images/base.png'),
  //   sort: 3,
  //   bridgeSpeed: 2,
  // },
  [arbitrum.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        version: '2',
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Tether USD',
        address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
    },
    name: 'Arbitrum',
    icon: require('@/assets/images/arbitrum.png'),
    sort: 4,
    bridgeSpeed: 2,
  },
  [fuse.id]: {
    tokens: {
      FUSE: {
        name: 'FUSE',
        fullName: 'FUSE',
        address: NATIVE_TOKEN_ADDRESS,
        icon: require('@/assets/images/fuse-4x.png'),
        isNative: true,
      },
      USDC: {
        name: 'USDC',
        fullName: 'Stargate USDC.e',
        address: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
        version: '2',
      },
      USDT: {
        name: 'USDT',
        fullName: 'Stargate USDT',
        address: '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7',
        icon: require('@/assets/images/usdt.png'),
        version: '1',
        isPermit: false,
      },
      WFUSE: {
        name: 'WFUSE',
        fullName: 'Wrapped FUSE',
        address: WRAPPED_FUSE,
        icon: require('@/assets/images/wfuse.png'),
      },
    },
    name: 'Fuse',
    icon: require('@/assets/images/fuse.png'),
    sort: 6,
    bridgeSpeed: 0,
  },
  [bsc.id]: {
    tokens: {
      USDC: {
        name: 'USDC',
        fullName: 'Binance-Peg USD Coin',
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        decimals: 18,
        isPermit: false,
      },
      USDT: {
        name: 'USDT',
        fullName: 'Binance-Peg BSC-USD',
        address: '0x55d398326f99059fF775485246999027B3197955',
        icon: require('@/assets/images/usdt.png'),
        decimals: 18,
        isPermit: false,
      },
    },
    name: 'BNB Chain',
    icon: require('@/assets/images/bsc.png'),
    sort: 5,
    bridgeSpeed: 2,
  },
};

/**
 * EURC, Circle's euro stablecoin, on the chains "Fund your card" offers it on.
 *
 * Deliberately not in `BRIDGE_TOKENS`: every surface that offers a token on a
 * chain reads that map, and EURC belongs to one of them. The backend delivers a
 * EURC card deposit as EURC to the user's Safe on Base, where the Base
 * spend-module instance sells it for euro purchases. A card deposit mints no
 * savings share, and EURC sent straight to the Safe on Ethereum would stay on
 * Ethereum.
 *
 * The one savings use is the soEURC vault (QA/preview builds only, see
 * `EUR_VAULT`): its deposit form reads EURC from here through
 * `getVaultDepositToken`, so listing EURC for that vault still leaves it out of
 * every `BRIDGE_TOKENS` surface. Its other way in is the vault's savings deposit
 * address (`SAVINGS_FUND_EURC`), which takes EURC on Base only.
 *
 * Base only for now. The backend also accepts EURC sent from Ethereum
 * (`EURC_ETHEREUM_ADDRESS`) and bridges it to Base, but that leg is not offered
 * here until the backend wallet carries an Ethereum EURC float to pay the
 * bridge's exact-output overshoot. Adding the entry offers it. The wallet and
 * soEURC deposit screens take Ethereum EURC through rhino.fi instead, which
 * pays it out as EURC on Base and needs no float of ours.
 */
export const EURC_TOKENS: Record<number, BridgeToken> = {
  [base.id]: {
    name: 'EURC',
    fullName: 'EURC',
    address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    decimals: 6,
    icon: require('@/assets/images/eurc.png'),
    isPermit: false,
  },
};

/**
 * ETH and WETH on Base, as soETH deposit tokens only. The Safe deposits them into
 * the Base soETH teller itself (lib/deposit/soEthBase.ts). Kept out of
 * BRIDGE_TOKENS[base], which every surface that offers a token on a chain reads:
 * listing them there would offer them to bridging and card funding as well.
 */
export const SOETH_BASE_DEPOSIT_TOKENS: Record<string, BridgeToken> = {
  ETH: {
    name: 'ETH',
    fullName: 'Ether',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    icon: require('@/assets/images/eth.png'),
    isPermit: false,
    isNative: true,
  },
  WETH: {
    name: 'WETH',
    fullName: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    icon: require('@/assets/images/weth.png'),
    isPermit: false,
  },
};

/**
 * What soBTC takes, by chain: WBTC on Ethereum, cbBTC on Base. Offered to the BTC vault alone,
 * like SOETH_BASE_DEPOSIT_TOKENS, so neither appears in bridging or card funding.
 */
export const SOBTC_DEPOSIT_TOKENS: Record<number, Record<string, BridgeToken>> = {
  [mainnet.id]: {
    WBTC: {
      name: 'WBTC',
      fullName: 'Wrapped BTC',
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      decimals: 8,
      icon: require('@/assets/images/wbtc.png'),
      isPermit: false,
    },
  },
  [base.id]: {
    cbBTC: {
      name: 'cbBTC',
      fullName: 'Coinbase Wrapped BTC',
      address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      decimals: 8,
      icon: require('@/assets/images/cbbtc.png'),
      isPermit: false,
    },
  },
};

/**
 * Circle's EURC on Ethereum, as rhino.fi lists it
 * (`/sda/deposit-addresses/ETHEREUM/BASE/supported-tokens`) and Circle
 * publishes it. Only for the screens that take it through rhino.fi (the wallet
 * deposit address, soEURC's direct deposit); not in `EURC_TOKENS`, which would
 * offer it to card funding and the savings deposit form as well.
 */
export const EURC_ETHEREUM_ADDRESS = '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c';

export const getUsdcAddress = (chainId: number) => {
  const usdcAddress = BRIDGE_TOKENS[chainId]?.tokens?.USDC?.address;
  if (!usdcAddress) {
    throw new Error(`USDC address not found for chain ${chainId}`);
  }
  return usdcAddress;
};

/**
 * Decimals of a bridge source token, by token name, defaulting to 6.
 *
 * Most chains' USDC/USDT are 6 decimals (hence the default), but BNB Chain's
 * Binance-Peg USDC/USDT are 18. Hardcoding 6 there under-approves the pull by
 * 1e12, so the backend's transferFrom can never be covered and the deposit
 * stalls at the allowance step. Always derive decimals from here.
 */
export const getBridgeTokenDecimals = (chainId: number, tokenName: string): number => {
  const tokens = BRIDGE_TOKENS[chainId]?.tokens;
  const token = tokens ? Object.values(tokens).find(t => t.name === tokenName) : undefined;
  return token?.decimals ?? 6;
};

/**
 * Chains the wallet holds tokens on that are not bridge sources.
 *
 * Kept out of `BRIDGE_TOKENS` for the same reason Base USDT is: every surface
 * that offers a chain reads that map, so listing Optimism there would offer it
 * for card funding, savings and withdrawals, none of which have a route on it.
 * It is only somewhere a deposit lands (see `WALLET_DEPOSIT_TOKENS`), so it
 * needs a name and an icon wherever a held token's chain is drawn.
 */
const WALLET_ONLY_CHAINS: BridgeTokens = {
  [optimism.id]: {
    name: 'Optimism',
    icon: require('@/assets/images/op.png'),
    sort: 7,
  },
};

/**
 * The name and icon to draw a chain with: a bridge source, or a chain the
 * wallet only holds tokens on. Callers read `.name` and `.icon` off it
 * unguarded, so a token held on Optimism must not come back undefined.
 */
export const getBridgeChain = (chainId: number) => {
  return BRIDGE_TOKENS[chainId] ?? WALLET_ONLY_CHAINS[chainId];
};
