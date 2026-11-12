import { Address, Chain, zeroAddress } from 'viem';
import { base, mainnet } from 'viem/chains';

import { ADDRESSES } from '@/lib/config';

/** Whether this build has a Base soETH deployment. Every Base soETH path is off without one. */
export const isSoEthBaseConfigured =
  ADDRESSES.base.soEthVault !== zeroAddress &&
  ADDRESSES.base.soEthTeller !== zeroAddress &&
  ADDRESSES.base.soEthAccountant !== zeroAddress &&
  ADDRESSES.base.soEthBoringQueue !== zeroAddress;

/**
 * A chain soETH shares are redeemed on, by a withdraw request on that chain's queue for its WETH.
 *
 * Ethereum: shares on Fuse bridge there first, and the queue pays out of the Ethereum vault, which
 * is where Lido's withdrawal queue frees ETH. Base: shares already on Base (a Base or Ethereum
 * deposit since soETH moved there) request in one step, paid from the WETH the Base vault holds.
 */
export type SoEthWithdrawChain = {
  chain: Chain;
  /** How the network is named in the withdraw flow's copy. */
  name: string;
  vault: Address;
  boringQueue: Address;
  weth: Address;
};

export const SOETH_WITHDRAW_CHAINS: Record<typeof mainnet.id | typeof base.id, SoEthWithdrawChain> =
  {
    [mainnet.id]: {
      chain: mainnet,
      name: 'Ethereum',
      vault: ADDRESSES.ethereum.soEthVault,
      boringQueue: ADDRESSES.ethereum.soEthBoringQueue,
      weth: ADDRESSES.ethereum.weth,
    },
    [base.id]: {
      chain: base,
      name: 'Base',
      vault: ADDRESSES.base.soEthVault,
      boringQueue: ADDRESSES.base.soEthBoringQueue,
      weth: ADDRESSES.base.weth,
    },
  };

export type SoEthWithdrawChainId = keyof typeof SOETH_WITHDRAW_CHAINS;

/**
 * The withdraw chain for soETH shares sitting on `chainId`, or undefined when shares there cannot
 * be withdrawn directly (Fuse, which bridges to Ethereum first).
 */
export const getSoEthWithdrawChain = (
  chainId: number | undefined,
): SoEthWithdrawChainId | undefined => {
  if (chainId === mainnet.id) return mainnet.id;
  if (chainId === base.id && isSoEthBaseConfigured) return base.id;
  return undefined;
};
