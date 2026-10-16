import { zeroAddress } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import {
  ADDRESSES,
  EXPO_PUBLIC_MINIMUM_ETH_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_FUSE_DEPOSIT_AMOUNT,
  EXPO_PUBLIC_MINIMUM_SPONSOR_AMOUNT,
} from '@/lib/config';
import { Vault, VaultType } from '@/lib/types';

const BRIDGE_CHAIN_IDS = Object.keys(BRIDGE_TOKENS).map(Number);

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
      // Shares sit on Base between a withdrawal's bridge and its queue request.
      // Kept last: screens that show one share address read vaults[0].
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
    ],
    depositConfig: {
      methods: ['wallet'],
      supportedChains: [mainnet.id],
      supportedTokens: ['WETH', 'ETH'],
    },
    vaultName: 'ETH Yield',
  },
];
