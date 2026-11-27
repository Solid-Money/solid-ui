import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

/** What one spend-module instance (Fuse, or Base) can put toward a card payment, in micro-USD. */
export interface InstanceSpendable {
  /** The mode this instance itself holds, which after an unfinished switch is not the card's. */
  mode: SpendMode;
  /** The cardholder's own spendable holdings on this instance. */
  cashMicroUsd: bigint;
  /** What is left of this instance's credit line. */
  creditMicroUsd: bigint;
}

const larger = (a: bigint, b: bigint): bigint => (a > b ? a : b);

/** What one instance can fund in the mode it is really in: Smart takes either path, never both. */
export const instanceSpendable = ({
  mode,
  cashMicroUsd,
  creditMicroUsd,
}: InstanceSpendable): bigint =>
  mode === 'cash'
    ? cashMicroUsd
    : mode === 'credit'
      ? creditMicroUsd
      : larger(cashMicroUsd, creditMicroUsd);

/**
 * The most a single card payment can use.
 *
 * One instance always pays the whole amount (the backend's routing never splits a purchase), so
 * this is the largest instance figure and not their sum: summed, the tile and the declined-payment
 * banner said "enough" for a payment no instance could cover. Each instance counts by its own
 * mode, so one still on Cash counts its cash and not a credit line it will not lend.
 */
export const singlePaymentSpendable = (instances: readonly InstanceSpendable[]): bigint =>
  instances.reduce((most, instance) => larger(most, instanceSpendable(instance)), 0n);
