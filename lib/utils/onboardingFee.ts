import { Address, encodeFunctionData, erc20Abi, isAddress } from 'viem';

/**
 * Paying the one-time Rain onboarding fee.
 *
 * The user transfers the fee from their own Safe to the treasury and the server
 * reads the transfer back off the chain to credit it. Nothing here talks to the
 * network — it decides which asset to pay with and how much of it, and builds
 * the one call that moves it, so the same numbers are shown in the sheet, sent
 * on chain and reported to the backend.
 */

/** One asset the user could pay the fee with. */
export interface FeePaymentAsset {
  tokenAddress: Address;
  symbol: string;
  decimals: number;
  /** The user's holding, in the token's smallest unit. */
  balance: bigint;
  /** USD per whole token. soUSD is a vault share, so this is its accountant rate. */
  usdPerToken: number;
}

/** A sized payment: which asset, how much of it, and what that is worth. */
export interface FeePayment {
  asset: FeePaymentAsset;
  /** Amount to transfer, in the token's smallest unit. */
  amount: bigint;
  /** What the user is paying, in USD, as the client prices it. */
  amountUsd: number;
}

/** What a holding is worth, in USD. */
export function assetBalanceUsd(asset: FeePaymentAsset): number {
  if (!Number.isFinite(asset.usdPerToken) || asset.usdPerToken <= 0) return 0;
  return (Number(asset.balance) / 10 ** asset.decimals) * asset.usdPerToken;
}

/**
 * How much of `asset` is worth `feeUsd`, rounded UP to the next base unit.
 *
 * Up, never down, and this matters: the server values the transfer with its own
 * price a moment later, and a payment rounded down lands fractionally under the
 * fee. The server allows a small tolerance for exactly this drift, but paying
 * the floor spends it before the rate has even moved.
 */
export function sizeFeeAmount(feeUsd: number, asset: FeePaymentAsset): bigint {
  if (!Number.isFinite(feeUsd) || feeUsd <= 0) return 0n;
  if (!Number.isFinite(asset.usdPerToken) || asset.usdPerToken <= 0) return 0n;

  const scale = 10 ** asset.decimals;
  return BigInt(Math.ceil((feeUsd / asset.usdPerToken) * scale));
}

/**
 * Which asset to pay with, and how much.
 *
 * Takes the first asset in the caller's own order that actually covers the fee,
 * rather than the largest holding. The order encodes a preference the amounts
 * cannot: soUSD before USDC, because soUSD is where a Solid balance normally
 * sits and spending it leaves the user's USDC for the things USDC is for.
 *
 * Returns undefined when nothing covers it — the sheet then asks the user to
 * add funds instead of building a transfer that would revert.
 */
export function selectFeePayment(
  feeUsd: number,
  assets: FeePaymentAsset[],
): FeePayment | undefined {
  if (!Number.isFinite(feeUsd) || feeUsd <= 0) return undefined;

  for (const asset of assets) {
    const amount = sizeFeeAmount(feeUsd, asset);
    if (amount > 0n && asset.balance >= amount) {
      return {
        asset,
        amount,
        amountUsd: (Number(amount) / 10 ** asset.decimals) * asset.usdPerToken,
      };
    }
  }

  return undefined;
}

/** A call to append to a user operation. */
export interface FeeTransferCall {
  to: Address;
  data: `0x${string}`;
  value: bigint;
}

/**
 * The ERC-20 transfer that pays the fee.
 *
 * Returns null when the treasury address is missing or malformed. That is not a
 * defensive formality: the server refuses a payment that did not reach the
 * treasury, so a transfer built against a guessed address would take the user's
 * money and leave the fee unpaid.
 */
export function buildFeeTransfer(params: {
  treasuryAddress: string | undefined;
  tokenAddress: Address;
  amount: bigint;
}): FeeTransferCall | null {
  const { treasuryAddress, tokenAddress, amount } = params;

  if (!treasuryAddress || !isAddress(treasuryAddress)) return null;
  if (!isAddress(tokenAddress)) return null;
  if (amount <= 0n) return null;

  return {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [treasuryAddress as Address, amount],
    }),
    value: 0n,
  };
}
