import { Address, encodeFunctionData, erc20Abi, Hex } from 'viem';

import BridgePaymasterABI from '@/lib/abis/BridgePayamster';
import { CrossChainSendAuthorised } from '@/lib/types/cross-chain-send';

export type CrossChainSendCall = { to: Address; data: Hex; value: bigint };

/**
 * The two calls of one cross-chain send user operation, in order: approve the
 * BridgePaymaster for the gross amount, then `bridgeSend(voucher, signature)`.
 *
 * Pure (no React, no RN imports) so the end-to-end run against a Fuse fork
 * executes exactly the calldata the app sends.
 */
export const buildCrossChainSendCalls = (
  authorised: Pick<
    CrossChainSendAuthorised,
    'voucher' | 'signature' | 'bridgePaymaster' | 'tokenAddress'
  >,
): CrossChainSendCall[] => {
  const { voucher, signature } = authorised;
  const amountLD = BigInt(voucher.amountLD);
  const bridgePaymaster = authorised.bridgePaymaster as Address;

  return [
    {
      to: authorised.tokenAddress as Address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [bridgePaymaster, amountLD],
      }),
      value: 0n,
    },
    {
      to: bridgePaymaster,
      data: encodeFunctionData({
        abi: BridgePaymasterABI,
        functionName: 'bridgeSend',
        args: [
          {
            from: voucher.from as Address,
            oft: voucher.oft as Address,
            dstEid: Number(voucher.dstEid),
            to: voucher.to as Address,
            amountLD,
            feeLD: BigInt(voucher.feeLD),
            maxNativeFee: BigInt(voucher.maxNativeFee),
            minAmountLD: BigInt(voucher.minAmountLD),
            nonce: BigInt(voucher.nonce),
            deadline: BigInt(voucher.deadline),
          },
          signature as Hex,
        ],
      }),
      value: 0n,
    },
  ];
};
