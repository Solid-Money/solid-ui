import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { EURC_TOKENS } from '@/constants/bridge';

import type { AssetPath } from '@/lib/assets';

/** The groups "Select token" lists, in display order. */
export type WalletDepositTokenGroup = 'stablecoins' | 'crypto';

export const WALLET_DEPOSIT_TOKEN_GROUPS: { key: WalletDepositTokenGroup; label: string }[] = [
  { key: 'stablecoins', label: 'Stablecoins' },
  { key: 'crypto', label: 'Crypto' },
];

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
  /** More words the search matches, so "bitcoin" finds cbBTC and "zcash" finds cbZEC. */
  aliases?: string[];
  /**
   * The chains it is offered on to everyone. Any other chain in `contracts` —
   * every one, for a token without this — is offered only to those given the
   * new deposit tokens (see `useDepositTokensAccess`): the internal team in
   * production while they are rolled out, everyone on qa/preview builds.
   */
  releasedOn?: number[];
};

/**
 * Every currency the deposit address takes, in the order "Select token" lists
 * them within each group, and the chains each is taken on.
 *
 * Only what the card can spend once it lands. The address is the user's Safe
 * unless the pipeline mints one (see `usesDirectDepositAddress`), and nothing
 * moves what lands on the Safe, so a Safe deposit is offered only on the chains
 * the card spends from and only in the tokens it spends there (see
 * `CARD_SPEND_CHAIN_IDS`):
 *
 * - Base: USDC, USDT, WETH, cbBTC, cbZEC, AAVE and SOL, each on the Base cash
 *   module's allowlist.
 * - Fuse: USDC and USDT, the Stargate contracts the Fuse cash module allowlists.
 *
 * A Wirex cardholder's USDC, USDT and EURC go to a minted address instead, which
 * the pipeline delivers to their Safe on Fuse (EURC: on Base), so for them the
 * stablecoins are offered on every chain the pipeline routes from. That is what
 * the other chains' USDC and USDT contracts are for.
 *
 * Add a token or chain here only once the card can spend it there. ETH, FUSE and
 * WFUSE are not on any allowlist, and native ETH is not WETH, so none of them is
 * offered. SOL and cbZEC are wrapped ERC-20s: the address is an EVM one, so the
 * native coins cannot be sent to it.
 *
 * Deliberately not `BRIDGE_TOKENS`: every surface that offers a token on a chain
 * reads that map, so listing these there would offer them for card funding,
 * savings and bridging, none of which can take them.
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
      [bsc.id]: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      [fuse.id]: '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9',
    },
    releasedOn: [mainnet.id, polygon.id, base.id, arbitrum.id, bsc.id, fuse.id],
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
      [bsc.id]: '0x55d398326f99059fF775485246999027B3197955',
      [fuse.id]: '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7',
    },
    releasedOn: [mainnet.id, polygon.id, base.id, arbitrum.id, bsc.id, fuse.id],
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
    releasedOn: Object.keys(EURC_TOKENS).map(Number),
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    group: 'crypto',
    icon: 'images/cbbtc.png',
    aliases: ['Bitcoin', 'Coinbase'],
    contracts: {
      [base.id]: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    },
  },
  {
    symbol: 'cbZEC',
    name: 'Coinbase Wrapped ZEC',
    group: 'crypto',
    icon: 'images/zec.png',
    aliases: ['Zcash', 'ZEC'],
    contracts: {
      [base.id]: '0xB2000000000000000000008501b13360000cb2EC',
    },
  },
  {
    symbol: 'AAVE',
    name: 'Aave',
    group: 'crypto',
    icon: 'images/aave.png',
    contracts: {
      [base.id]: '0x63706e401c06ac8513145b7687A14804d17f814b',
    },
  },
  {
    // The Base–Solana bridge's SOL.
    symbol: 'SOL',
    name: 'Solana',
    group: 'crypto',
    icon: 'images/sol.png',
    aliases: ['Wrapped SOL'],
    contracts: {
      [base.id]: '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
    },
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    group: 'crypto',
    icon: 'images/weth.png',
    contracts: {
      [base.id]: '0x4200000000000000000000000000000000000006',
    },
    releasedOn: [base.id],
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
  bsc.id,
  fuse.id,
];

/**
 * The chains the card spends from, and so the only ones the Safe is offered on:
 * a token that lands in the Safe anywhere else stays there, out of the card's
 * reach. The minted address is not bound by this (see `WALLET_DEPOSIT_TOKENS`).
 */
export const CARD_SPEND_CHAIN_IDS: readonly number[] = [base.id, fuse.id];

const depositContractKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

const DEPOSIT_CONTRACT_KEYS: ReadonlySet<string> = new Set(
  WALLET_DEPOSIT_TOKENS.flatMap(token =>
    Object.entries(token.contracts).map(([chainId, address]) =>
      depositContractKey(Number(chainId), address),
    ),
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
