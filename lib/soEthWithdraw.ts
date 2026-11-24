import {
  Address,
  Chain,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  zeroAddress,
} from 'viem';
import { readContract } from 'viem/actions';
import { base, mainnet } from 'viem/chains';

import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/** Whether this build has a Base soETH deployment. Every Base soETH path is off without one. */
export const isSoEthBaseConfigured =
  ADDRESSES.base.soEthVault !== zeroAddress &&
  ADDRESSES.base.soEthTeller !== zeroAddress &&
  ADDRESSES.base.soEthAccountant !== zeroAddress &&
  ADDRESSES.base.soEthBoringQueue !== zeroAddress;

/**
 * Where soETH shares are redeemed: the Ethereum queue, for Ethereum WETH.
 *
 * Only Ethereum. Lido's withdrawal queue frees ETH into the Ethereum vault, while the Base vault
 * holds idle WETH that falls short of supply × rate, so Base solves revert unless topped up by hand.
 * Shares on Fuse or Base bridge to Ethereum first (step 1), then request there (step 2). The Base
 * queue is kept only to show and cancel requests made before this change.
 */
export type SoEthWithdrawChain = {
  chain: Chain;
  /** How the network is named in the withdraw flow's copy. */
  name: string;
  vault: Address;
  boringQueue: Address;
  weth: Address;
};

export const SOETH_WITHDRAW_CHAINS: Record<typeof mainnet.id, SoEthWithdrawChain> = {
  [mainnet.id]: {
    chain: mainnet,
    name: 'Ethereum',
    vault: ADDRESSES.ethereum.soEthVault,
    boringQueue: ADDRESSES.ethereum.soEthBoringQueue,
    weth: ADDRESSES.ethereum.weth,
  },
};

export type SoEthWithdrawChainId = keyof typeof SOETH_WITHDRAW_CHAINS;

/**
 * The withdraw chain for soETH shares sitting on `chainId`, or undefined when shares there must
 * bridge to Ethereum first (Fuse and Base).
 */
export const getSoEthWithdrawChain = (
  chainId: number | undefined,
): SoEthWithdrawChainId | undefined => (chainId === mainnet.id ? mainnet.id : undefined);

/** Paying the LayerZero fee in the chain's native token. */
const NATIVE_FEE_TOKEN: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/** `abi.encode(uint32 eid)` naming Ethereum (LayerZero eid 30101) as the bridge destination. */
const ETHEREUM_BRIDGE_WILDCARD = encodeAbiParameters(parseAbiParameters('uint32'), [30101]);

/**
 * The LayerZero fee, in Base wei, for the Base soETH teller to send shares to `to` on Ethereum.
 * The teller requires `msg.value` to equal the quote exactly, so bridge with a fresh one.
 */
export const readSoEthBaseBridgeFee = (to: Address) =>
  readContract(publicClient(base.id), {
    address: ADDRESSES.base.soEthTeller,
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'previewFee',
    args: [0n, to, ETHEREUM_BRIDGE_WILDCARD, NATIVE_FEE_TOKEN],
  });

/** Step 1 for soETH on Base: send `shares` to the same Safe on Ethereum, paying `fee` as value. */
export const buildSoEthBaseBridgeToEthereumCall = (shares: bigint, to: Address, fee: bigint) => ({
  to: ADDRESSES.base.soEthTeller,
  data: encodeFunctionData({
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'bridge',
    args: [shares, to, ETHEREUM_BRIDGE_WILDCARD, NATIVE_FEE_TOKEN, fee],
  }),
  value: fee,
});
