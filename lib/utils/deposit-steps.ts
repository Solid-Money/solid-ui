import { ActivityEvent, DepositStep, TransactionStatus, TransactionType } from '@/lib/types';

export const DEPOSIT_STEPS = [
  { key: 'received' as const, label: 'Received' },
  { key: 'confirmed' as const, label: 'Confirmed' },
  { key: 'depositing' as const, label: 'Depositing' },
  { key: 'minting' as const, label: 'Minting' },
  { key: 'complete' as const, label: 'Complete' },
] as const;

/**
 * Steps the backend used to emit before `received` existed, mapped onto the
 * current ladder so old activities still render a sensible progress state.
 */
const LEGACY_STEP_ALIASES: Record<string, DepositStep> = {
  detected: 'received',
  transferring_to_card: 'depositing',
};

export function normalizeDepositStep(step?: string | null): DepositStep | undefined {
  if (!step) return undefined;
  if (DEPOSIT_STEPS.some(s => s.key === step)) return step as DepositStep;
  return LEGACY_STEP_ALIASES[step];
}

/**
 * Coarse step implied by the activity status. Used when the backend never sent
 * an explicit step (SSE event missed, older activity) and to stop a stale
 * `metadata.depositStep` from holding the progress back.
 */
function inferStepFromStatus(status: TransactionStatus): DepositStep | undefined {
  if (status === TransactionStatus.SUCCESS) return 'complete';
  if (status === TransactionStatus.PROCESSING) return 'confirmed';
  if (status === TransactionStatus.DETECTED) return 'received';
  return undefined;
}

/**
 * Extract the current deposit step from an activity.
 * Uses explicit metadata.depositStep when it is ahead of what the status
 * implies, otherwise falls back to the status (handles SSE-missed events).
 */
export function getDepositStep(activity: ActivityEvent): DepositStep | undefined {
  const explicit = normalizeDepositStep(activity.metadata?.depositStep as string | undefined);
  const inferred = inferStepFromStatus(activity.status);

  if (!explicit) return inferred;
  if (!inferred) return explicit;

  return getDepositStepIndex(inferred) > getDepositStepIndex(explicit) ? inferred : explicit;
}

/**
 * Check if an activity is a deposit type that supports step tracking.
 */
export function isDepositWithSteps(activity: ActivityEvent): boolean {
  return (
    activity.type === TransactionType.DEPOSIT || activity.type === TransactionType.BRIDGE_DEPOSIT
  );
}

/**
 * Get the step index (0-based) for a deposit step.
 * Returns -1 if step is undefined.
 */
export function getDepositStepIndex(step: DepositStep | undefined): number {
  if (!step) return -1;
  return DEPOSIT_STEPS.findIndex(s => s.key === step);
}

/**
 * Get a user-friendly description for the current deposit step.
 * Used in the Transaction card in the activity list.
 */
export function getDepositStepDescription(step: DepositStep | undefined): string | null {
  switch (step) {
    case 'received':
      return 'Transfer detected';
    case 'confirmed':
      return 'Transfer confirmed';
    case 'depositing':
      return 'Depositing to vault...';
    case 'minting':
      return 'Minting your savings position...';
    case 'complete':
      return null; // Handled by SUCCESS status display
    default:
      return null;
  }
}

export type DepositProgressState = 'complete' | 'active' | 'pending' | 'failed';

export type DepositProgressRow = {
  key: 'received' | 'confirmed' | 'depositing';
  label: string;
  state: DepositProgressState;
};

const CONFIRMED_INDEX = getDepositStepIndex('confirmed');
const COMPLETE_INDEX = getDepositStepIndex('complete');

/** Direct deposits are flagged by the webhook handler through metadata.description. */
function isDirectDeposit(activity: ActivityEvent): boolean {
  const description = activity.metadata?.description;
  return description === 'Direct deposit' || description === 'Card deposit';
}

/** Vault share tokens — a deposit denominated in one of these mints savings. */
const VAULT_SHARE_SYMBOLS = ['sousd', 'sofuse', 'soeth'];

/**
 * True when a deposit ends up in the user's savings.
 *
 * Two shapes reach this: connect-wallet deposits, which are denominated in the
 * share token they mint (soUSD / soETH / soFUSE), and direct deposits, which keep
 * the deposited token as their symbol (USDC, ETH, ...) and record the
 * destination the webhook routed them to. Both have to be recognised, or a
 * savings deposit reads as one into the wallet.
 */
export function isSavingsDestination(activity: ActivityEvent): boolean {
  if (activity.metadata?.destinationType === 'RAIN_CARD') return false;
  if (activity.metadata?.destinationType === 'PROTOCOL') return true;
  if (activity.metadata?.vaultShareSymbol) return true;

  const symbol = activity.symbol?.toLowerCase();
  return !!symbol && VAULT_SHARE_SYMBOLS.includes(symbol);
}

function destinationLabel(activity: ActivityEvent): string {
  if (activity.metadata?.destinationType === 'RAIN_CARD') return 'card';
  if (isSavingsDestination(activity)) return 'savings';
  return 'balance';
}

/**
 * Local amount formatter — this module is imported by pure unit tests, so it
 * deliberately avoids pulling in `@/lib/utils` (react-native / wagmi barrel).
 */
function formatStepAmount(amount: string): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return amount;
  return new Intl.NumberFormat('en-us', { maximumFractionDigits: 6 }).format(num);
}

function receivedLabel(activity: ActivityEvent, state: DepositProgressState): string {
  const amount = formatStepAmount(activity.amount);
  const symbol = activity.symbol ?? '';

  if (isDirectDeposit(activity)) {
    return state === 'complete'
      ? `We received your ${amount} ${symbol}`.trim()
      : 'Waiting for your transfer';
  }

  return state === 'complete'
    ? `We received your ${amount} ${symbol}`.trim()
    : `Sending ${amount} ${symbol} from your wallet`.trim();
}

function confirmedLabel(state: DepositProgressState): string {
  if (state === 'complete') return 'Confirmed on the network';
  if (state === 'failed') return 'Transaction failed to confirm';
  return 'Waiting for network confirmations';
}

function depositingLabel(activity: ActivityEvent, state: DepositProgressState): string {
  const symbol = activity.symbol ?? '';
  const destination = destinationLabel(activity);

  if (state === 'complete') return `${symbol} added to your ${destination}`.trim();
  if (state === 'failed') return `Failed to deposit ${symbol} to your ${destination}`.trim();
  return `Depositing ${symbol} to your ${destination}`.trim();
}

/**
 * Build the three progress rows shown on the deposit detail screen.
 *
 * The five-step ladder is collapsed into the three rows the design calls for:
 * `depositing` and `minting` are both "still moving your funds", so they share
 * the last row.
 */
export function getDepositProgressRows(activity: ActivityEvent): DepositProgressRow[] {
  const stepIndex = getDepositStepIndex(getDepositStep(activity));
  const isFailed =
    activity.status === TransactionStatus.FAILED ||
    activity.status === TransactionStatus.CANCELLED ||
    activity.status === TransactionStatus.EXPIRED;

  const stateFor = (completeAt: number, activeAt: number): DepositProgressState => {
    if (stepIndex >= completeAt) return 'complete';
    if (stepIndex >= activeAt) return isFailed ? 'failed' : 'active';
    return 'pending';
  };

  const receivedState = stateFor(0, -1);
  const confirmedState = stateFor(CONFIRMED_INDEX, 0);
  const depositingState = stateFor(COMPLETE_INDEX, CONFIRMED_INDEX);

  return [
    { key: 'received', label: receivedLabel(activity, receivedState), state: receivedState },
    { key: 'confirmed', label: confirmedLabel(confirmedState), state: confirmedState },
    {
      key: 'depositing',
      label: depositingLabel(activity, depositingState),
      state: depositingState,
    },
  ];
}
