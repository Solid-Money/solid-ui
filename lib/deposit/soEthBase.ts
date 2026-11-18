import { type Address, encodeFunctionData, erc20Abi } from 'viem';
import { readContract } from 'viem/actions';
import { base } from 'viem/chains';

import Accountant from '@/lib/abis/Accountant';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

export { isSoEthBaseConfigured } from '@/lib/soEthWithdraw';

/**
 * Deposits into soETH on Base.
 *
 * ETH and WETH deposited on Base mint their shares in the Base vault, straight to the depositor;
 * the WETH stays in the Base vault, which is also what pays a Base withdrawal. The teller's
 * `deposit` is public and mints to `msg.sender`, so the Safe deposits itself, as for soEURC.
 */

export const SOETH_DECIMALS = 18;

/**
 * How far below the quoted share count a deposit may mint before it reverts. The rate only moves
 * on an accountant update, so this covers one landing between the quote and the user operation,
 * as for soEURC.
 */
export const SOETH_MINT_SLIPPAGE_BPS = 50n;

const WETH_DEPOSIT_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

/**
 * The `minimumMint` for depositing `amount` WETH at `rateInQuote` (WETH per share, 18 decimals).
 * Mirrors the teller, `shares = amount * ONE_SHARE / rate`, less the slippage allowance.
 */
export const getSoEthMinimumMint = (amount: bigint, rateInQuote: bigint): bigint => {
  if (amount <= 0n || rateInQuote <= 0n) return 0n;
  const expectedShares = (amount * 10n ** BigInt(SOETH_DECIMALS)) / rateInQuote;
  return (expectedShares * (10_000n - SOETH_MINT_SLIPPAGE_BPS)) / 10_000n;
};

/** The Base teller's WETH rate. `Safe` reverts while the accountant is paused. */
export const readSoEthBaseDepositRate = () =>
  readContract(publicClient(base.id), {
    address: ADDRESSES.base.soEthAccountant,
    abi: Accountant,
    functionName: 'getRateInQuoteSafe',
    args: [ADDRESSES.base.weth],
  });

/**
 * The calls a Base soETH deposit sends from the Safe, batched in one user operation: wrap native
 * ETH first when that is what is deposited, approve the VAULT (the BoringVault pulls the WETH in
 * `enter`) for exactly the amount, then deposit through the teller, which mints to the Safe.
 *
 * Native ETH is wrapped here rather than sent to the teller as value: the deposit then takes one
 * path whichever form the user holds.
 */
export const buildSoEthBaseDepositCalls = (
  amount: bigint,
  minimumMint: bigint,
  isNativeEth: boolean,
): { to: Address; data: `0x${string}`; value: bigint }[] => [
  ...(isNativeEth
    ? [
        {
          to: ADDRESSES.base.weth,
          data: encodeFunctionData({ abi: WETH_DEPOSIT_ABI, functionName: 'deposit' }),
          value: amount,
        },
      ]
    : []),
  {
    to: ADDRESSES.base.weth,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [ADDRESSES.base.soEthVault, amount],
    }),
    value: 0n,
  },
  {
    to: ADDRESSES.base.soEthTeller,
    data: encodeFunctionData({
      abi: ETHEREUM_TELLER_ABI,
      functionName: 'deposit',
      args: [ADDRESSES.base.weth, amount, minimumMint],
    }),
    value: 0n,
  },
];
