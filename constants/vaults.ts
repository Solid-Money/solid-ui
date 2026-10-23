import { base, fuse, mainnet } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import {
  ADDRESSES,
  EXPO_PUBLIC_MINIMUM_ETH_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_EUR_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_FUSE_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
} from '@/lib/config';
import { Vault, VaultType } from '@/lib/types';

const BRIDGE_CHAIN_IDS = Object.keys(BRIDGE_TOKENS).map(Number);

/**
 * soEURC — EURC on Base, earning in euros.
 *
 * In every build's VAULTS, so a soEURC held anywhere is recognised and can be withdrawn. Who is
 * OFFERED it is per user: everyone on QA/preview, the Wirex test users in production — see
 * `useEurVaultAccess`, which the Earn row, savings vault list, deposit picker and deep link check.
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
    ],
    depositConfig: {
      methods: ['wallet'],
      supportedChains: [mainnet.id],
      supportedTokens: ['WETH', 'ETH'],
    },
    vaultName: 'ETH Yield',
  },
  // Always last: `useSavingStore` persists the selected vault as an index into
  // this list, so inserting a vault ahead of the others would move a returning
  // user's selection onto a different vault.
  EUR_VAULT,
];
