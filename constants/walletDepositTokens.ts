import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import { WRAPPED_FUSE } from '@/constants/addresses';
import { EURC_TOKENS } from '@/constants/bridge';

import type { AssetPath } from '@/lib/assets';

/** The three groups "Select token" lists, in display order. */
export type WalletDepositTokenGroup = 'stablecoins' | 'metals' | 'crypto';

export const WALLET_DEPOSIT_TOKEN_GROUPS: { key: WalletDepositTokenGroup; label: string }[] = [
  { key: 'stablecoins', label: 'Stablecoins' },
  { key: 'metals', label: 'Gold & silver' },
  { key: 'crypto', label: 'Crypto' },
];

/** A chain's own coin (ETH, FUSE), sent as value rather than through a contract. */
export const NATIVE_COIN = 'native';

export type WalletDepositTokenConfig = {
  symbol: string;
  /** The full name under the ticker, and something to search by. */
  name: string;
  group: WalletDepositTokenGroup;
  /** Drawn through `getAsset`; a path, so this list loads without the images. */
  icon: AssetPath;
  /**
   * The contract on each chain the deposit address takes it on, in the order
   * "Select network" lists them. Each was read on chain: its symbol, name and
   * decimals, and a supply worth sending to.
   */
  contracts: Record<number, string>;
  /** More words the search matches, so "bitcoin" finds cbBTC as well as WBTC. */
  aliases?: string[];
  /**
   * The chain the address opens on, where Base (the default) is not where the
   * asset lives: ARB on Arbitrum, OP on Optimism, the wrapped coins on the
   * chain exchanges send them on.
   */
  homeChainId?: number;
  /** Only on qa/preview builds (see `isDevFeatureEnabled`). */
  devOnly?: boolean;
};

/**
 * Every currency the deposit address takes, in the order "Select token" lists
 * them within each group, and the chains each is taken on.
 *
 * The address is the user's Safe on every chain, so whatever lands on it stays
 * as the token that was sent: none of these top up the card or Earn. Only a
 * Wirex cardholder's stablecoins go anywhere else (see
 * `usesDirectDepositAddress`).
 *
 * Deliberately not `BRIDGE_TOKENS`: every surface that offers a token on a chain
 * reads that map, so listing these there would offer them for card funding,
 * savings and bridging, none of which can take them.
 *
 * SOL, NEAR and ZEC are their wrapped ERC-20s: the address is an EVM one, so the
 * native coins cannot be sent to it. Each is listed only on the chains it has a
 * canonical bridged token on.
 */
export const WALLET_DEPOSIT_TOKENS: WalletDepositTokenConfig[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    group: 'stablecoins',
    icon: 'images/usdc-4x.png',
    contracts: {
      [mainnet.id]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      [polygon.id]: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      [bsc.id]: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      [fuse.id]: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
    },
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    group: 'stablecoins',
    icon: 'images/usdt.png',
    contracts: {
      [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      [polygon.id]: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      [base.id]: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      [arbitrum.id]: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      [optimism.id]: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      [bsc.id]: '0x55d398326f99059fF775485246999027B3197955',
      [fuse.id]: '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7',
    },
  },
  {
    // Wirex cardholders only (see `offersWalletDepositEurc`), on the chains
    // `EURC_TOKENS` lists, which the pipeline delivers from.
    symbol: 'EURC',
    name: 'Euro Coin',
    group: 'stablecoins',
    icon: 'images/eurc.png',
    contracts: Object.fromEntries(
      Object.entries(EURC_TOKENS).map(([chainId, token]) => [chainId, token.address]),
    ),
  },
  {
    symbol: 'PAXG',
    name: 'Gold',
    group: 'metals',
    icon: 'images/paxg.png',
    aliases: ['PAX Gold', 'Paxos'],
    contracts: {
      [mainnet.id]: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
    },
    homeChainId: mainnet.id,
  },
  {
    // An xStock — a token of the iShares Silver Trust ETF — and stocks are not
    // offered in production yet (see `useNav`), so neither is this until it has
    // cleared compliance.
    symbol: 'SLVx',
    name: 'Silver',
    group: 'metals',
    icon: 'images/slvx.png',
    aliases: ['iShares Silver Trust', 'xStock'],
    contracts: {
      [mainnet.id]: '0x4833e7f4f0460f4B72A3a5879A6C9841bCC5B58B',
    },
    homeChainId: mainnet.id,
    devOnly: true,
  },
  {
    // Binance-Peg ETH on BNB Chain: what an exchange sends for "ETH on BEP20".
    symbol: 'ETH',
    name: 'Ether',
    group: 'crypto',
    icon: 'images/eth.png',
    aliases: ['Ethereum'],
    contracts: {
      [mainnet.id]: NATIVE_COIN,
      [base.id]: NATIVE_COIN,
      [arbitrum.id]: NATIVE_COIN,
      [optimism.id]: NATIVE_COIN,
      [bsc.id]: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    },
  },
  {
    // Base and BNB Chain carry the LayerZero WBTC, the same contract on both.
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    group: 'crypto',
    icon: 'images/wbtc.png',
    aliases: ['Bitcoin', 'BTC'],
    contracts: {
      [mainnet.id]: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      [polygon.id]: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      [base.id]: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      [arbitrum.id]: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      [optimism.id]: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      [bsc.id]: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
    },
    homeChainId: mainnet.id,
  },
  {
    symbol: 'FUSE',
    name: 'Fuse',
    group: 'crypto',
    icon: 'images/fuse-4x.png',
    contracts: {
      [fuse.id]: NATIVE_COIN,
    },
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    group: 'crypto',
    icon: 'images/cbbtc.png',
    aliases: ['Bitcoin', 'Coinbase'],
    contracts: {
      [mainnet.id]: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      [base.id]: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      [arbitrum.id]: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    },
  },
  {
    // Binance-Peg ZEC: the only EVM Zcash with a market.
    symbol: 'ZEC',
    name: 'Zcash',
    group: 'crypto',
    icon: 'images/zec.png',
    contracts: {
      [bsc.id]: '0x1Ba42e5193dfA8B03D15dd1B86a3113bbBEF8Eeb',
    },
    homeChainId: bsc.id,
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    group: 'crypto',
    icon: 'images/uni.png',
    contracts: {
      [mainnet.id]: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      [polygon.id]: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
      [base.id]: '0xc3De830EA07524a0761646a6a4e4be0e114a3C83',
      [arbitrum.id]: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
      [optimism.id]: '0x6fd9d7AD17242c41f7131d257212c54A0e816691',
      [bsc.id]: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1',
    },
    homeChainId: mainnet.id,
  },
  {
    // Binance-Peg NEAR, and the Rainbow Bridge's on Ethereum (24 decimals).
    symbol: 'NEAR',
    name: 'Near',
    group: 'crypto',
    icon: 'images/near.png',
    aliases: ['NEAR Protocol'],
    contracts: {
      [mainnet.id]: '0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4',
      [bsc.id]: '0x1Fa4a73a3F0133f0025378af00236f3aBDEE5D63',
    },
    homeChainId: bsc.id,
  },
  {
    // Off Ethereum, ENA is Ethena's LayerZero token, the same contract everywhere.
    symbol: 'ENA',
    name: 'Ethena',
    group: 'crypto',
    icon: 'images/ena.png',
    contracts: {
      [mainnet.id]: '0x57e114B691Db790C35207b2e685D4A43181e6061',
      [base.id]: '0x58538e6A46E07434d7E7375Bc268D3cb839C0133',
      [arbitrum.id]: '0x58538e6A46E07434d7E7375Bc268D3cb839C0133',
      [optimism.id]: '0x58538e6A46E07434d7E7375Bc268D3cb839C0133',
      [bsc.id]: '0x58538e6A46E07434d7E7375Bc268D3cb839C0133',
    },
    homeChainId: mainnet.id,
  },
  {
    symbol: 'AAVE',
    name: 'Aave',
    group: 'crypto',
    icon: 'images/aave.png',
    contracts: {
      [mainnet.id]: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      [polygon.id]: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
      [base.id]: '0x63706e401c06ac8513145b7687A14804d17f814b',
      [arbitrum.id]: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196',
      [optimism.id]: '0x76FB31fb4af56892A25e32cFC43De717950c9278',
      [bsc.id]: '0xfb6115445Bff7b52FeB98650C87f44907E58f802',
    },
    homeChainId: mainnet.id,
  },
  {
    // Wormhole's SOL on Ethereum, Polygon and Arbitrum, the Base–Solana bridge's
    // on Base, and Binance-Peg SOL on BNB Chain.
    symbol: 'SOL',
    name: 'Solana',
    group: 'crypto',
    icon: 'images/sol.png',
    aliases: ['Wrapped SOL'],
    contracts: {
      [mainnet.id]: '0xD31a59c85aE9D8edEFeC411D448f90841571b89c',
      [polygon.id]: '0xd93f7E271cB87c23AaA73edC008A79646d1F9912',
      [base.id]: '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
      [arbitrum.id]: '0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07',
      [bsc.id]: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
    },
  },
  {
    symbol: 'WLD',
    name: 'Worldcoin',
    group: 'crypto',
    icon: 'images/wld.png',
    aliases: ['World'],
    contracts: {
      [mainnet.id]: '0x163f8C2467924be0ae7B5347228CABF260318753',
      [optimism.id]: '0xdC6fF44d5d932Cbd77B52E5612Ba0529DC6226F1',
    },
    homeChainId: optimism.id,
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    group: 'crypto',
    icon: 'images/arb.png',
    contracts: {
      [mainnet.id]: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
      [arbitrum.id]: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    },
    homeChainId: arbitrum.id,
  },
  {
    symbol: 'OP',
    name: 'Optimism',
    group: 'crypto',
    icon: 'images/op.png',
    contracts: {
      [optimism.id]: '0x4200000000000000000000000000000000000042',
    },
    homeChainId: optimism.id,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    group: 'crypto',
    icon: 'images/weth.png',
    contracts: {
      [mainnet.id]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      [polygon.id]: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      [base.id]: '0x4200000000000000000000000000000000000006',
      [arbitrum.id]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      [optimism.id]: '0x4200000000000000000000000000000000000006',
    },
  },
  {
    symbol: 'WFUSE',
    name: 'Wrapped FUSE',
    group: 'crypto',
    icon: 'images/wfuse.png',
    contracts: {
      [fuse.id]: WRAPPED_FUSE,
    },
  },
];

/**
 * The chains a deposit can be sent on, in the order "Select network" lists them:
 * the L2s together, Fuse last.
 */
export const WALLET_DEPOSIT_CHAIN_IDS: readonly number[] = [
  mainnet.id,
  polygon.id,
  base.id,
  arbitrum.id,
  optimism.id,
  bsc.id,
  fuse.id,
];

const depositContractKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

const DEPOSIT_CONTRACT_KEYS: ReadonlySet<string> = new Set(
  WALLET_DEPOSIT_TOKENS.flatMap(token =>
    Object.entries(token.contracts)
      .filter(([, address]) => address !== NATIVE_COIN)
      .map(([chainId, address]) => depositContractKey(Number(chainId), address)),
  ),
);

/**
 * Whether a contract is one the deposit screen tells people to send.
 *
 * The wallet only shows a token the curated swap list names (see
 * `useBalances`), and that list is for the swap picker. A token someone was
 * told they could deposit must show once it lands, listed for swapping or not.
 */
export const isWalletDepositContract = (chainId: number, address: string | undefined): boolean =>
  !!address && DEPOSIT_CONTRACT_KEYS.has(depositContractKey(chainId, address));

/** Every deposit contract on every chain, for lists keyed the same way. */
export const getWalletDepositContracts = (): { chainId: number; address: string }[] =>
  Array.from(DEPOSIT_CONTRACT_KEYS, key => {
    const [chainId, address] = key.split(':');
    return { chainId: Number(chainId), address };
  });
