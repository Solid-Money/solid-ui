import { Address, encodeFunctionData, erc20Abi, Hex } from 'viem';

import { WRAPPED_FUSE } from '@/constants/addresses';
import BridgePaymasterABI from '@/lib/abis/BridgePayamster';
import { wNativeABI } from '@/lib/abis/tokens';
import { LifiSwapQuote, LifiSwapSponsorship } from '@/lib/types/lifi-swap';

export type SponsoredLifiCall = { to: Address; data: Hex; value: bigint };

/** A LI.FI quote the sending network's BridgePaymaster makes the call for. */
export type SponsoredLifiQuote = Pick<LifiSwapQuote, 'transactionRequest'> & {
  sponsorship: LifiSwapSponsorship;
};

const approve = (token: Address, spender: Address, amount: bigint): SponsoredLifiCall => ({
  to: token,
  data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }),
  value: 0n,
});

/**
 * The calls of one sponsored LI.FI swap, in order, for the user operation on
 * the sending network:
 *
 * 1. With `wrapNative`, `WFUSE.deposit()` for the amount: LI.FI has no route
 *    for native FUSE, so the swap is quoted from WFUSE.
 * 2. For an ERC-20, an exact approval of the paymaster, reset to 0 first when
 *    `allowance` (the Safe's current one to the paymaster) isn't, as USDT on
 *    Ethereum requires.
 * 3. `paymaster.lifiCall(voucher, LI.FI's calldata, signature)`, carrying the
 *    amount when the swap takes the native coin. The paymaster adds Stargate's
 *    fee on top and calls LI.FI.
 *
 * No approval of LI.FI itself: the paymaster pulls the coin and approves it.
 * Pure, so the calldata can be checked without React or the network.
 */
export function buildSponsoredLifiCalls(
  quote: SponsoredLifiQuote,
  allowance: bigint,
): SponsoredLifiCall[] {
  const { paymaster, wrapNative, voucher, signature } = quote.sponsorship;
  const token = voucher.token as Address;
  const amount = BigInt(voucher.amount);
  const isNative = BigInt(token) === 0n;
  const calls: SponsoredLifiCall[] = [];

  if (wrapNative) {
    if (token.toLowerCase() !== WRAPPED_FUSE.toLowerCase())
      throw new Error('A sponsored swap that wraps FUSE has to spend WFUSE.');
    calls.push({
      to: WRAPPED_FUSE,
      data: encodeFunctionData({ abi: wNativeABI, functionName: 'deposit' }),
      value: amount,
    });
  }

  if (!isNative) {
    if (allowance > 0n) calls.push(approve(token, paymaster, 0n));
    calls.push(approve(token, paymaster, amount));
  }

  calls.push({
    to: paymaster,
    data: encodeFunctionData({
      abi: BridgePaymasterABI,
      functionName: 'lifiCall',
      args: [
        {
          from: voucher.from as Address,
          target: voucher.target as Address,
          token,
          amount,
          dataHash: voucher.dataHash as Hex,
          nativeFee: BigInt(voucher.nativeFee),
          nonce: BigInt(voucher.nonce),
          deadline: BigInt(voucher.deadline),
        },
        quote.transactionRequest.data,
        signature,
      ],
    }),
    value: isNative ? amount : 0n,
  });

  return calls;
}
