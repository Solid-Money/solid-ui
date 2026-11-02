import { encodeFunctionData, erc20Abi } from 'viem';
import { readContract } from 'viem/actions';
import { base } from 'viem/chains';

import { type StockVault } from '@/constants/stockVaults';
import Accountant from '@/lib/abis/Accountant';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { publicClient } from '@/lib/wagmi';

/**
 * Deposits into a stock vault (soAAPL, soNVDA…) on Base: the soEURC deposit, keyed
 * by the vault's config instead of hard-coded.
 *
 * The teller is a plain `TellerWithMultiAssetSupport`: `deposit` is public, mints
 * to `msg.sender`, and the BoringVault pulls the stock token itself in `enter()`
 * with `transferFrom`. So the approval goes to the VAULT, not the teller.
 */

/**
 * How far below the quoted share count a deposit may mint before it reverts. As for
 * soEURC: the rate only moves on an accountant update, so this guards against one
 * landing between the quote and the user operation. The tellers have no share
 * premium for the stock tokens today.
 */
export const STOCK_VAULT_MINT_SLIPPAGE_BPS = 50n;

/**
 * The `minimumMint` for depositing `amount` of the stock token at `rateInQuote`
 * (stock token per share, 8 decimals — 1e8 is one for one). Mirrors the teller's
 * own maths, `shares = amount * ONE_SHARE / rate`, less the slippage allowance.
 */
export const getStockVaultMinimumMint = (
  stock: Pick<StockVault, 'shareDecimals'>,
  amount: bigint,
  rateInQuote: bigint,
): bigint => {
  if (amount <= 0n || rateInQuote <= 0n) return 0n;
  const oneShare = 10n ** BigInt(stock.shareDecimals);
  const expectedShares = (amount * oneShare) / rateInQuote;
  return (expectedShares * (10_000n - STOCK_VAULT_MINT_SLIPPAGE_BPS)) / 10_000n;
};

/** The teller's rate for the stock token. `Safe` reverts while the accountant is paused. */
export const readStockVaultDepositRate = (stock: StockVault) =>
  readContract(publicClient(base.id), {
    address: stock.accountant,
    abi: Accountant,
    functionName: 'getRateInQuoteSafe',
    args: [stock.stockToken.address],
  });

/**
 * The two calls a stock vault deposit sends from the depositor: approve the vault
 * for exactly the amount, then deposit through the teller. Batched in one user
 * operation from the Safe, so the approval never outlives the deposit.
 */
export const buildStockVaultDepositCalls = (
  stock: StockVault,
  amount: bigint,
  minimumMint: bigint,
) => [
  {
    to: stock.stockToken.address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [stock.vault, amount],
    }),
    value: 0n,
  },
  {
    to: stock.teller,
    data: encodeFunctionData({
      abi: ETHEREUM_TELLER_ABI,
      functionName: 'deposit',
      args: [stock.stockToken.address, amount, minimumMint],
    }),
    value: 0n,
  },
];
