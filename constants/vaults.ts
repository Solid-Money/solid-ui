import { zeroAddress } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import {
  ADDRESSES,
  EXPO_PUBLIC_MINIMUM_BTC_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_ETH_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_FUSE_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
} from '@/lib/config';
import { isSoBtcConfigured, SOBTC_ADDRESSES, SOBTC_DECIMALS } from '@/lib/soBtc';
import { isSoEthBaseConfigured } from '@/lib/soEthWithdraw';
import { Vault, VaultType } from '@/lib/types';

const BRIDGE_CHAIN_IDS = Object.keys(BRIDGE_TOKENS).map(Number);

/**
 * soEURC — EURC on Base, earning in euros.
 *
 * Offered to everyone, in every build, like the other vaults.
 * v1 takes EURC on Base only, from the Solid wallet or a connected external wallet;
 * there is no fast withdraw and no on-ramp or bridge into it.
 */
export const EUR_VAULT: Vault = {
  name: 'EUR',
  type: VaultType.EUR,
  vaultToken: 'soEURC',
  icon: 'images/eurc.png',
  decimals: 6,
  minimumAmount: EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
  vaults: [
    {
      address: ADDRESSES.base.soEurcVault,
      chainId: base.id,
    },
  ],
  depositConfig: {
    methods: ['wallet'],
    supportedChains: [base.id],
    supportedTokens: ['EURC'],
  },
  vaultName: 'EUR Yield',
};

/**
 * soBTC — BTC Yield. WBTC on Ethereum and cbBTC on Base, each kept in its own chain's vault and
 * never bridged; one share, held on Base whichever was deposited (lib/soBtc.ts).
 *
 * Listed only in a build with both soBTC deployments (`isSoBtcConfigured`).
 */
export const BTC_VAULT: Vault = {
  name: 'BTC',
  type: VaultType.BTC,
  vaultToken: 'soBTC',
  icon: 'images/btc.png',
  decimals: SOBTC_DECIMALS,
  minimumAmount: EXPO_PUBLIC_MINIMUM_BTC_DEPOSIT_AMOUNT,
  vaults: [
    // Base first: screens that show one share address read vaults[0].
    { address: SOBTC_ADDRESSES.base.vault, chainId: base.id },
    // Shares only sit on Ethereum between the two steps of a WBTC withdrawal.
    { address: SOBTC_ADDRESSES.ethereum.vault, chainId: mainnet.id },
  ],
  depositConfig: {
    methods: ['wallet'],
    supportedChains: [mainnet.id, base.id],
    supportedTokens: ['WBTC', 'cbBTC'],
  },
  vaultName: 'BTC Yield',
};

export const VAULTS: Vault[] = [
  {
    name: 'USDC',
    type: VaultType.USDC,
    vaultToken: 'soUSD',
    icon: 'images/usdc-4x.png',
    decimals: 6,
    minimumAmount: EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
    vaults: [
      {
        address: ADDRESSES.ethereum.vault,
        chainId: mainnet.id,
      },
      {
        address: ADDRESSES.fuse.vault,
        chainId: fuse.id,
      },
      // soUSD deposited on Base keeps its shares on Base, where the card spends
      // them. Kept last: screens that show one share address read vaults[0].
      ...(ADDRESSES.base.vault !== zeroAddress
        ? [{ address: ADDRESSES.base.vault, chainId: base.id }]
        : []),
    ],
    depositConfig: {
      methods: [
        'wallet',
        'deposit_directly',
        'credit_card',
        //'bank_transfer'
      ],
      supportedChains: BRIDGE_CHAIN_IDS,
      supportedTokens: ['USDC', 'USDT'],
    },
    vaultName: 'USD Yield',
  },
  {
    name: 'FUSE',
    type: VaultType.FUSE,
    vaultToken: 'soFUSE',
    icon: 'images/fuse-4x.png',
    decimals: 18,
    minimumAmount: EXPO_PUBLIC_MINIMUM_FUSE_DEPOSIT_AMOUNT,
    vaults: [
      {
        address: ADDRESSES.fuse.fuseVault,
        chainId: fuse.id,
      },
    ],
    depositConfig: {
      methods: ['wallet'],
      supportedChains: [fuse.id],
      supportedTokens: ['WFUSE', 'FUSE'],
    },
    vaultName: 'FUSE Yield',
  },
  {
    name: 'ETH',
    icon: 'images/eth.png',
    type: VaultType.ETH,
    vaultToken: 'soETH',
    decimals: 18,
    minimumAmount: EXPO_PUBLIC_MINIMUM_ETH_DEPOSIT_AMOUNT,
    vaults: [
      {
        address: ADDRESSES.ethereum.soEthVault,
        chainId: mainnet.id,
      },
      {
        address: ADDRESSES.fuse.soEthVault,
        chainId: fuse.id,
      },
      // ETH and WETH deposited on Base, and Ethereum deposits, mint their shares
      // on Base, where the card spends and lends against them. Kept last:
      // screens that show one share address read vaults[0].
      ...(isSoEthBaseConfigured ? [{ address: ADDRESSES.base.soEthVault, chainId: base.id }] : []),
    ],
    depositConfig: {
      methods: ['wallet'],
      // Base takes a deposit from the Solid wallet only: the Safe calls the Base
      // teller itself (lib/deposit/soEthBase.ts).
      supportedChains: isSoEthBaseConfigured ? [mainnet.id, base.id] : [mainnet.id],
      supportedTokens: ['WETH', 'ETH'],
    },
    vaultName: 'ETH Yield',
  },
  // `useSavingStore` persists the selected vault as an index into this list, so
  // a vault is only ever added at the end: inserting one ahead of the others
  // would move a returning user's selection onto a different vault.
  EUR_VAULT,
  ...(isSoBtcConfigured ? [BTC_VAULT] : []),
];
