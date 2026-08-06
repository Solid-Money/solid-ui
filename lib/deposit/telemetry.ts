import * as Sentry from '@sentry/react-native';

import { ERRORS } from '@/constants/errors';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track, trackIdentity } from '@/lib/analytics';
import { getAttributionChannel } from '@/lib/attribution';
import { StatusInfo, User } from '@/lib/types';
import { useAttributionStore } from '@/store/useAttributionStore';

/**
 * Shared deposit instrumentation.
 *
 * Every deposit hook used to carry its own copy of the same four tracking calls,
 * the same Sentry scaffolding and the same error-message mapping, which is how
 * they drifted apart - some emitted `chain_name`, some did not; some mapped
 * "user denied" to a friendly message, some only "user rejected". Funnels are
 * only comparable across deposit methods if every method reports identically.
 */

/** Attribution snapshot, read at call time so it reflects the current session. */
const attribution = () => {
  const data = useAttributionStore.getState().getAttributionForEvent();
  return { ...data, attribution_channel: getAttributionChannel(data) };
};

export type DepositContext = {
  user?: User;
  amount: string;
  chainId?: number;
  chainName?: string;
  /** Where the funds come from: the Solid wallet or an external wallet. */
  depositType: 'solid_wallet' | 'connected_wallet';
  /** The specific route, e.g. `usdc_solid_base_card`. */
  depositMethod: string;
  depositDestination?: 'card' | 'savings';
  isSponsor?: boolean;
  /** Sentry tag identifying the calling hook, e.g. `deposit_from_solid_usdc`. */
  operation: string;
};

const baseProps = (ctx: DepositContext) => ({
  user_id: ctx.user?.userId,
  safe_address: ctx.user?.safeAddress,
  amount: ctx.amount,
  deposit_type: ctx.depositType,
  deposit_method: ctx.depositMethod,
  ...(ctx.depositDestination && { deposit_destination: ctx.depositDestination }),
  chain_id: ctx.chainId,
  ...(ctx.chainName && { chain_name: ctx.chainName }),
  ...(ctx.isSponsor !== undefined && { is_sponsor: ctx.isSponsor }),
});

export const trackDepositInitiated = (ctx: DepositContext) => {
  track(TRACKING_EVENTS.DEPOSIT_INITIATED, { ...baseProps(ctx), ...attribution() });
};

export const trackDepositValidated = (ctx: DepositContext) => {
  track(TRACKING_EVENTS.DEPOSIT_VALIDATED, baseProps(ctx));
};

/**
 * Amplitude's copy of this event is emitted server-side by the deposit workflow
 * ("Savings/Card Deposit Completed"), so the client suppresses Amplitude here to
 * avoid double-counting. Firebase and GTM still fire for web attribution.
 */
export const trackDepositCompleted = (
  ctx: DepositContext,
  extra?: { transactionHash?: string; chainName?: string },
) => {
  const attributionData = attribution();
  track(
    TRACKING_EVENTS.DEPOSIT_COMPLETED,
    {
      ...baseProps(ctx),
      ...(extra?.transactionHash && { transaction_hash: extra.transactionHash }),
      is_first_deposit: !ctx.user?.isDeposited,
      ...attributionData,
    },
    { amplitude: false },
  );

  if (ctx.user?.userId) {
    trackIdentity(ctx.user.userId, {
      last_deposit_amount: parseFloat(ctx.amount),
      last_deposit_date: new Date().toISOString(),
      last_deposit_method: ctx.depositMethod,
      last_deposit_chain: extra?.chainName ?? ctx.chainName,
      ...attributionData,
    });
  }
};

/**
 * Map a raw error to the short message the deposit sheet shows. Returns '' when
 * there is nothing worth surfacing, matching the previous per-hook behaviour of
 * leaving the field blank for unrecognised failures.
 */
export const depositErrorMessage = (error: unknown): string => {
  const raw = (error as { message?: string })?.message ?? '';
  const msg = raw.toLowerCase();

  if (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected by user') ||
    msg.includes('user cancelled')
  ) {
    return 'User rejected transaction';
  }
  if (raw.includes(ERRORS.WAIT_TRANSACTION_RECEIPT)) return ERRORS.WAIT_TRANSACTION_RECEIPT;
  if (raw.includes(ERRORS.ERROR_SWITCHING_CHAIN)) return ERRORS.ERROR_SWITCHING_CHAIN;
  return '';
};

/**
 * Report a failed deposit to Sentry + analytics and return the user-facing
 * message. Callers keep ownership of their own UI state and rethrow.
 */
export const captureDepositError = (
  error: unknown,
  ctx: DepositContext & { depositStatus?: StatusInfo; step?: string },
): string => {
  const errorMessage = (error as { message?: string })?.message || 'Unknown error';

  Sentry.captureException(error, {
    tags: { operation: ctx.operation, step: ctx.step ?? 'execution' },
    extra: {
      amount: ctx.amount,
      safeAddress: ctx.user?.safeAddress,
      chainId: ctx.chainId,
      errorMessage,
      depositStatus: ctx.depositStatus,
    },
    user: { id: ctx.user?.suborgId, address: ctx.user?.safeAddress },
  });

  track(TRACKING_EVENTS.DEPOSIT_ERROR, {
    ...baseProps(ctx),
    // Kept alongside chain_id: existing dashboards key off src_chain_id.
    src_chain_id: ctx.chainId,
    source: ctx.operation,
    error: errorMessage,
    deposit_status: ctx.depositStatus,
    ...attribution(),
  });

  return depositErrorMessage(error);
};

/** Sentry breadcrumb for a deposit milestone. */
export const depositBreadcrumb = (message: string, data?: Record<string, unknown>) => {
  Sentry.addBreadcrumb({ message, category: 'deposit', data });
};
