import { EndorsementStatus } from '@/components/BankTransfer/enums';

/**
 * Stable identifier for a card-activation step. Consumers key off this instead
 * of the array index or numeric `id`, so steps can be reordered (e.g. the
 * Bangladesh "deposit first" step) without breaking lookups.
 */
export type StepKey = 'deposit' | 'kyc' | 'activate' | 'spend';

export interface Step {
  id: number;
  /** Stable identity of the step; safe to key off across reordering. */
  key: StepKey;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  status?: 'pending' | 'completed';
  endorsementStatus?: EndorsementStatus;
}
