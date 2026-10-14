import { type Address, encodeFunctionData, erc20Abi } from 'viem';
import { readContract } from 'viem/actions';
import { base } from 'viem/chains';

import { EURC_TOKENS } from '@/constants/bridge';
import Accountant from '@/lib/abis/Accountant';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/**
 * Deposits into soEURC, the EUR vault on Base.
 *
 * The teller is a plain `TellerWithMultiAssetSupport`: `deposit` is public, mints
 * to `msg.sender`, and the BoringVault pulls the EURC itself in `enter()` with
 * `transferFrom`. So the approval goes to the VAULT, not the teller — the same
 * shape as the soFUSE deposit from the Solid wallet (WFUSE approved to the FUSE
 * vault, then the FUSE teller called).
 */

/** EURC on Base, the one asset soEURC takes in v1. */
export const SOEURC_DEPOSIT_ASSET = EURC_TOKENS[base.id].address as Address;
export const SOEURC_DECIMALS = 6;

/**
 * How far below the quoted share count a deposit may mint before it reverts.
 * The rate only moves on an accountant update, so this guards against one landing
 * between the quote and the user operation rather than against market slippage.
 * An asset share premium larger than this would make deposits revert rather than
 * silently mint less; the teller has none for EURC today.
 */
export const SOEURC_MINT_SLIPPAGE_BPS = 50n;

/**
 * The `minimumMint` for depositing `amount` EURC at `rateInQuote` (EURC per share,
 * 6 decimals — 1e6 is par). Mirrors the teller's own maths,
 * `shares = amount * ONE_SHARE / rate`, less the slippage allowance.
 */
export const getSoEurcMinimumMint = (amount: bigint, rateInQuote: bigint): bigint => {
  if (amount <= 0n || rateInQuote <= 0n) return 0n;
  const oneShare = 10n ** BigInt(SOEURC_DECIMALS);
  const expectedShares = (amount * oneShare) / rateInQuote;
  return (expectedShares * (10_000n - SOEURC_MINT_SLIPPAGE_BPS)) / 10_000n;
};

/** The teller's rate for EURC. `Safe` reverts while the accountant is paused. */
export const readSoEurcDepositRate = () =>
  readContract(publicClient(base.id), {
    address: ADDRESSES.base.soEurcAccountant,
    abi: Accountant,
    functionName: 'getRateInQuoteSafe',
    args: [SOEURC_DEPOSIT_ASSET],
  });

/**
 * The two calls a soEURC deposit sends from the depositor: approve the vault for
 * exactly the amount, then deposit through the teller. Batched in one user
 * operation from the Safe, so the approval never outlives the deposit.
 */
export const buildSoEurcDepositCalls = (amount: bigint, minimumMint: bigint) => [
  {
    to: SOEURC_DEPOSIT_ASSET,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [ADDRESSES.base.soEurcVault, amount],
    }),
    value: 0n,
  },
  {
    to: ADDRESSES.base.soEurcTeller,
    data: encodeFunctionData({
      abi: ETHEREUM_TELLER_ABI,
      functionName: 'deposit',
      args: [SOEURC_DEPOSIT_ASSET, amount, minimumMint],
    }),
    value: 0n,
  },
];
