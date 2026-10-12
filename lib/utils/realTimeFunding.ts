import { type Address, encodeFunctionData, erc20Abi } from 'viem';

import type { RainRtfChain, RainRtfStatus } from '@/lib/types';

/**
 * Real-Time Funding: which approvals are owed, and how they batch.
 *
 * Its own leaf module, with no React and no app imports, for the same reason
 * `cardStatusRouting` and `cardDepositGate` are: this is load-bearing — a
 * wrong allowance comparison hides the approval a card needs, a missed
 * (token, spender) pair leaves a card declining on an asset nobody checked,
 * and a wrong amount format misstates somebody's balance — and
 * `@/lib/utils`' import graph does not load under jest-expo, so logic that
 * lives there cannot be tested.
 */

/**
 * A token amount in smallest units, rendered for display.
 *
 * Takes a string because the values it formats come off the wire as strings:
 * an unlimited allowance is `uint256` max, which `number` cannot hold, and a
 * balance parsed through `number` loses precision long before that. The whole
 * part is computed with `BigInt` and only the fraction is ever formatted.
 *
 * Returns `null` for anything that is not a non-negative integer string, so a
 * malformed or absent value renders as "unknown" rather than as `NaN` or, far
 * worse, as `0` — which a cardholder would read as "my wallet is empty".
 */
export const formatTokenAmount = (
  rawAmount: string | null | undefined,
  decimals: number,
  maximumFractionDigits = 2,
): string | null => {
  if (typeof rawAmount !== 'string' || !/^\d+$/.test(rawAmount.trim())) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;

  const amount = BigInt(rawAmount.trim());
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  const wholeText = whole.toLocaleString('en-US');
  if (fraction === 0n || maximumFractionDigits === 0) return wholeText;

  // Left-pad to the token's full precision, then trim to the digits asked for
  // and drop trailing zeros. Slicing before padding would read 1 wei of a 6dp
  // token as 0.1.
  const fractionText = fraction
    .toString()
    .padStart(decimals, '0')
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, '');

  return fractionText ? `${wholeText}.${fractionText}` : wholeText;
};

/** Every approval a chain still owes, flattened across its assets. */
export interface PendingApproval {
  tokenAddress: string;
  symbol: string;
  spenderAddress: string;
}

/**
 * The (token, spender) pairs on this chain that still need approving.
 *
 * Flattened across assets because that is what an ERC-20 allowance actually
 * is: one per (token, owner, spender). A chain carrying USDC and EURC with
 * both the collateral contract and the operator as spenders owes four
 * approvals, and treating the chain as the unit — as a single `assetSymbol`
 * field invited — would silently approve one asset and leave the card
 * declining on the other.
 *
 * Pairs already at a healthy allowance are left out. Re-approving one is a
 * transaction the cardholder pays for and gains nothing from, and after a
 * batch that landed only partially it is the difference between resuming and
 * starting over.
 */
export const pendingApprovalsFor = (chain: RainRtfChain | undefined): PendingApproval[] =>
  (chain?.assets ?? []).flatMap(asset =>
    asset.spenders
      .filter(spender => !spender.isApproved)
      .map(spender => ({
        tokenAddress: asset.tokenAddress,
        symbol: asset.symbol,
        spenderAddress: spender.address,
      })),
  );

/**
 * The calls for one chain's outstanding approvals, ready to batch.
 *
 * Every one of them goes into a **single user operation**. They are `approve`
 * calls on the same chain from the same smart account, so the account signs
 * once and the bundler submits one operation — which is both cheaper and the
 * difference between a cardholder tapping Approve once and tapping it four
 * times without knowing why.
 *
 * What cannot be batched is chains. A user operation is executed by one
 * chain's EntryPoint against one account, so an approval on Base and an
 * approval on Arbitrum are two operations with two signatures, no matter how
 * they are presented. The flow walks them in turn instead; see
 * `useRainRealTimeFunding`.
 */
export const buildApprovalBatch = (params: {
  chain: RainRtfChain | undefined;
  /** The allowance to request, as a decimal string — `uint256` max. */
  maxAllowance: string;
}): { to: Address; data: `0x${string}`; value: bigint }[] => {
  const { chain, maxAllowance } = params;
  const amount = BigInt(maxAllowance);

  return pendingApprovalsFor(chain).map(approval => ({
    to: approval.tokenAddress as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [approval.spenderAddress as Address, amount],
    }),
    value: 0n,
  }));
};

/**
 * The chains still owing approvals, in the order to walk them, and the ones
 * already done.
 *
 * A chain with no assets, or whose assets have no spenders, is never offered:
 * there is nothing to approve against — Rain has provisioned no collateral
 * contract and the operator is switched off — so offering it would build an
 * empty batch and record a consent for an authorization that does not exist.
 */
export const selectRtfChains = (
  status: RainRtfStatus | undefined,
): {
  /** The chain to act on now. */
  chain: RainRtfChain | undefined;
  /** Every chain still owing approvals, this one first. */
  pendingChains: RainRtfChain[];
  approvedChains: RainRtfChain[];
} => {
  const chains = status?.chains ?? [];
  const pendingChains = chains.filter(
    entry => !entry.isApproved && pendingApprovalsFor(entry).length > 0,
  );

  return {
    chain: pendingChains[0],
    pendingChains,
    approvedChains: chains.filter(entry => entry.isApproved),
  };
};

/**
 * What the card screen shows for Real-Time Funding.
 *
 * Three states, not two, and the third is the point. The row began as a task
 * that vanished the moment the allowances landed, which left a cardholder who
 * had just approved with no confirmation it worked and no way to check later
 * — the only evidence was an allowance on a chain they cannot read. Keeping a
 * settled row says both: it worked, and this card draws from your wallet.
 *
 * - `hidden` — not a Rain card, tenant not enabled, cardholder not eligible,
 *   or there is simply nothing to show: no chain pending and none approved.
 *   The last case covers a chain with no spenders, where Rain has provisioned
 *   no collateral contract and the operator is off, so there is nothing to
 *   approve and nothing to report.
 * - `pending` — at least one chain still owes approvals. Takes precedence over
 *   `approved`: part-way through a multi-chain approval some chains are done
 *   and some are not, and the unfinished work is what the cardholder needs to
 *   see.
 * - `approved` — every offered chain is approved.
 */
export type RtfSectionState = 'hidden' | 'pending' | 'approved';

export const rtfSectionState = (params: {
  isRainCard: boolean;
  status: RainRtfStatus | undefined;
}): RtfSectionState => {
  const { isRainCard, status } = params;
  if (!isRainCard || !status?.tenantEnabled || !status.eligible) return 'hidden';

  const { chain, approvedChains } = selectRtfChains(status);
  if (chain !== undefined) return 'pending';
  return approvedChains.length > 0 ? 'approved' : 'hidden';
};

/**
 * Whether the card screen should offer the approval.
 *
 * Narrower than {@link rtfSectionState}: this one gates the modal and the
 * approve button, which only make sense while something is still owed.
 */
export const shouldOfferRtf = (params: {
  isRainCard: boolean;
  status: RainRtfStatus | undefined;
}): boolean => rtfSectionState(params) === 'pending';

/**
 * What a settled Real-Time Funding row reports.
 *
 * Drawn from the approved chains rather than from `describeApprovalWork`,
 * which describes pending work and is empty once everything has landed. Named
 * concretely — "USDC on Base" — for the same reason the pending row is: an
 * allowance is per token per chain, so "approved" on its own does not tell a
 * cardholder holding USDT0 on Plasma whether their card will work.
 */
export const describeApprovedFunding = (
  status: RainRtfStatus | undefined,
): { chainNames: string[]; assetSymbols: string[] } => {
  const { approvedChains } = selectRtfChains(status);

  return {
    chainNames: approvedChains.map(entry => entry.name),
    // Deduplicated by symbol: the same asset on two chains is two allowances
    // but one thing to name.
    assetSymbols: [
      ...new Set(approvedChains.flatMap(entry => entry.assets.map(asset => asset.symbol))),
    ],
  };
};

/**
 * How the approval is described before it is signed.
 *
 * Both halves are load-bearing and neither is the other: `approvals` is how
 * many allowances are being granted, `signatures` is how many times the
 * cardholder will be asked to confirm. They differ whenever a chain carries
 * more than one asset or more than one spender — which, mid-migration, is
 * every chain — and a screen that quoted only one of them would either
 * understate what is being granted or surprise somebody with a second
 * prompt.
 */
export const describeApprovalWork = (
  status: RainRtfStatus | undefined,
): {
  approvals: number;
  signatures: number;
  chainNames: string[];
  assetSymbols: string[];
} => {
  const { pendingChains } = selectRtfChains(status);

  return {
    // The backend's count, not a recount here: it is the number the approval
    // screen promises, and two places computing it is two places to disagree.
    approvals: pendingChains.reduce((total, entry) => total + entry.pendingApprovals, 0),
    // One per chain. Not a product of anything — this is the hard floor that
    // batching cannot get below.
    signatures: pendingChains.length,
    chainNames: pendingChains.map(entry => entry.name),
    // Across every pending chain, not just the first. Deduplicated by symbol
    // because the same asset on two chains is two allowances but one thing to
    // name — a cardholder reading "USDC and USDC" learns nothing, and listing
    // only the first chain's assets would understate what is being approved.
    assetSymbols: [
      ...new Set(pendingChains.flatMap(entry => entry.assets.map(asset => asset.symbol))),
    ],
  };
};
