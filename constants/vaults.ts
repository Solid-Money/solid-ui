import { fuse, mainnet } from 'viem/chains';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import { ADDRESSES } from '@/lib/config';
import { Vault } from '@/lib/types';

const BRIDGE_CHAIN_IDS = Object.keys(BRIDGE_TOKENS).map(Number);

export const VAULTS: Vault[] = [
  {
    name: 'USDC',
    icon: 'images/usdc-4x.png',
    decimals: 6,
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
      methods: ['wallet', 'deposit_directly', 'credit_card', 'bank_transfer'],
      supportedChains: BRIDGE_CHAIN_IDS,
      supportedTokens: ['USDC', 'USDT'],
    },
  },
  {
    name: 'FUSE',
    icon: 'images/fuse-4x.png',
    decimals: 18,
    vaults: [
      {
        address: ADDRESSES.fuse.fuseVault,
        chainId: fuse.id,
      },
    ],
    depositConfig: {
      methods: ['wallet', 'deposit_directly'],
      supportedChains: [fuse.id, mainnet.id],
      supportedTokens: ['FUSE', 'WFUSE'],
    },
  },
  {
    name: 'ETH',
    icon: 'images/eth.png',
    decimals: 18,
    vaults: [
      {
        address: ADDRESSES.ethereum.vault,
        chainId: mainnet.id,
      },
    ],
    depositConfig: {
      methods: ['wallet', 'deposit_directly', 'credit_card', 'bank_transfer'],
      supportedChains: BRIDGE_CHAIN_IDS,
      supportedTokens: ['USDC', 'USDT'],
    },
    isComingSoon: true,
  },
];
