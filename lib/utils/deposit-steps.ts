import { ActivityEvent, DepositStep, TransactionStatus, TransactionType } from '@/lib/types';

export const DEPOSIT_STEPS = [
  { key: 'detected' as const, label: 'Detected' },
  { key: 'confirmed' as const, label: 'Confirmed' },
  { key: 'depositing' as const, label: 'Depositing' },
  { key: 'minting' as const, label: 'Minting soUSD' },
  { key: 'complete' as const, label: 'Complete' },
] as const;

/**
 * Extract the current deposit step from an activity.
 * Uses explicit metadata.depositStep if available, falls back to status inference
 * (handles SSE-missed events when user reconnects).
 */
export function getDepositStep(activity: ActivityEvent): DepositStep | undefined {
  // If activity has an explicit step from backend, use it
  if (activity.metadata?.depositStep) {
    return activity.metadata.depositStep as DepositStep;
  }
  // Infer from status as fallback (SSE events may have been missed)
  if (activity.status === TransactionStatus.SUCCESS) return 'complete';
  if (activity.status === TransactionStatus.PROCESSING) return 'confirmed';
  if (activity.status === TransactionStatus.DETECTED) return 'detected';
  if (activity.status === TransactionStatus.PENDING) return 'detected';
  return undefined;
}

/**
 * Check if an activity is a deposit type that supports step tracking.
 */
export function isDepositWithSteps(activity: ActivityEvent): boolean {
  return (
    activity.type === TransactionType.DEPOSIT ||
    activity.type === TransactionType.BRIDGE_DEPOSIT
  );
}

/**
 * Get the step index (0-based) for a deposit step.
 * Returns -1 if step is undefined.
 */
export function getDepositStepIndex(step: DepositStep | undefined): number {
  if (!step) return -1;
  return DEPOSIT_STEPS.findIndex((s) => s.key === step);
}

/**
 * Get a user-friendly description for the current deposit step.
 * Used in the Transaction card in the activity list.
 */
export function getDepositStepDescription(step: DepositStep | undefined): string | null {
  switch (step) {
    case 'detected':
      return 'Transfer detected';
    case 'confirmed':
      return 'Transfer confirmed';
    case 'depositing':
      return 'Depositing to vault...';
    case 'minting':
      return 'Minting soUSD...';
    case 'complete':
      return null; // Handled by SUCCESS status display
    default:
      return null;
  }
}
