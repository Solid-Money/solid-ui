import { type Address, encodeFunctionData, erc20Abi, maxUint256 } from 'viem';

import { getTokenAllowance } from '@/lib/utils/contract';

export type ApproveCall = {
  to: Address;
  data: `0x${string}`;
  value: bigint;
};

/**
 * Build the ERC-20 approval that lets the backend pull a deposit out of the
 * Solid wallet.
 *
 * It approves `current allowance + amount` rather than the bare amount, because
 * ERC-20 `approve` *sets* the allowance instead of adding to it. Approving the
 * bare amount silently invalidated any deposit that had not been pulled yet:
 * the second deposit's approval overwrote the first's, the second pull consumed
 * it, and the first deposit could then never be settled - it retried against a
 * zero allowance until it died. Adding keeps concurrent deposits independent
 * while still leaving no standing allowance once each pull has taken its share.
 */
export const buildDepositApproval = async ({
  tokenAddress,
  owner,
  spender,
  amount,
  chainId,
}: {
  tokenAddress: Address;
  owner: Address;
  spender: Address;
  amount: bigint;
  chainId: number;
}): Promise<ApproveCall> => {
  let current = 0n;
  try {
    current = await getTokenAllowance(tokenAddress, owner, spender, chainId);
  } catch {
    // A failed read must not block the deposit: approving `amount` alone is the
    // old behaviour, which is still correct whenever nothing else is pending.
  }

  // Saturate rather than wrap - a pre-existing unlimited approval would
  // otherwise overflow uint256 and revert.
  const total = current > maxUint256 - amount ? maxUint256 : current + amount;

  return {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, total],
    }),
    value: 0n,
  };
};
