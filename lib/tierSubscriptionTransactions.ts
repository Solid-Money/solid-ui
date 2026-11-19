import { type Address, encodeFunctionData, erc20Abi, type Hex } from 'viem';

import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidSubscriptionModule_ABI } from '@/lib/abis/SolidSubscriptionModule';
import { UserCopyError } from '@/lib/errors/UserCopyError';

import type { TierPaymentMode } from '@/lib/types';

/** USDC, and therefore every amount the subscription module moves. */
export const BILLING_DECIMALS = 6;

/** The billing period a mandate is signed for. */
export const SUBSCRIPTION_PERIOD_SECONDS = 365n * 24n * 60n * 60n;

/** One call in the user operation the Safe signs. */
export interface SubscriptionTransaction {
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * A USD price as raw USDC.
 *
 * Rounded to whole cents before scaling, so a price stored as a decimal cannot
 * become a mandate — or a payment — a fraction off what was shown. Zero for
 * anything that is not a positive amount, which every caller reads as "not for
 * sale".
 */
export const usdToBillingUnits = (usd: number): bigint => {
  if (!Number.isFinite(usd) || usd <= 0) return 0n;
  return BigInt(Math.round(usd * 100)) * 10n ** BigInt(BILLING_DECIMALS - 2);
};

export interface SubscriptionTransactionParams {
  /** How the first year is paid — see `TierOffer.paymentMode`. */
  mode: TierPaymentMode;
  safeAddress: Address;
  moduleAddress: Address;
  /** Whether the Safe has already enabled the module. */
  moduleEnabled: boolean;
  /**
   * The per-period cap the mandate is signed at: the price the membership
   * renews at. Never the sale price — a mandate signed at a first-year discount
   * would refuse the first full-price renewal.
   */
  mandateUsd: number;
  /** `transfer` only: what the first year costs, paid to the treasury in this batch. */
  chargeUsd?: number;
  /** `transfer` only: the USDC being paid. */
  billingTokenAddress?: Address | null;
  /** `transfer` only: where the first year is paid to. */
  revenueTreasuryAddress?: Address | null;
}

/**
 * The calls that start a paid membership, as one user operation.
 *
 * `module` — the first-time subscriber — is enable-then-subscribe: the Safe
 * grants the module and bounds it in the same signature, and the backend takes
 * the first year through the module once this lands.
 *
 * `transfer` is the upgrade from a running membership. The module allows one
 * charge per period, and the lower tier has already used this period's, so the
 * backend cannot take the first year itself: the Safe pays it directly to the
 * treasury, in the same batch that raises the mandate to the new tier's price.
 * Batching is the point — the payment cannot land without the new mandate, or
 * the mandate without the payment.
 *
 * The module is enabled only when it is not already: enabling it twice reverts
 * the whole batch.
 */
export const buildSubscriptionTransactions = ({
  mode,
  safeAddress,
  moduleAddress,
  moduleEnabled,
  mandateUsd,
  chargeUsd,
  billingTokenAddress,
  revenueTreasuryAddress,
}: SubscriptionTransactionParams): SubscriptionTransaction[] => {
  const mandate = usdToBillingUnits(mandateUsd);
  if (mandate <= 0n) throw new UserCopyError('This tier is not available with an annual fee.');

  const subscribeCalls: SubscriptionTransaction[] = [
    ...(moduleEnabled
      ? []
      : [
          {
            to: safeAddress,
            data: encodeFunctionData({
              abi: Safe_ABI,
              functionName: 'enableModule',
              args: [moduleAddress],
            }),
            value: 0n,
          },
        ]),
    {
      to: moduleAddress,
      data: encodeFunctionData({
        abi: SolidSubscriptionModule_ABI,
        functionName: 'subscribe',
        args: [mandate, SUBSCRIPTION_PERIOD_SECONDS],
      }),
      value: 0n,
    },
  ];

  if (mode !== 'transfer') return subscribeCalls;

  const charge = usdToBillingUnits(chargeUsd ?? 0);
  if (charge <= 0n || !billingTokenAddress || !revenueTreasuryAddress) {
    throw new UserCopyError('Upgrading with an annual fee is not available right now.');
  }

  return [
    {
      to: billingTokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [revenueTreasuryAddress, charge],
      }),
      value: 0n,
    },
    ...subscribeCalls,
  ];
};
