import { EndorsementStatus } from '@/components/BankTransfer/enums';

/**
 * Stable identifier for a card-activation step. Consumers key off this instead
 * of the array index or numeric `id`, so steps can appear, disappear or be
 * reordered — the deposit step and the `hold` step below both do — without
 * breaking lookups.
 *
 * `hold` only ever appears for an applicant who cleared the deposit step and
 * then moved the money out again before their verification was submitted. It
 * asks them to put it back, and its action is what submits the application.
 */
export type StepKey = 'deposit' | 'kyc' | 'hold' | 'activate' | 'spend';

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
  /** Renders the step's action as busy, e.g. while its request is in flight. */
  isLoading?: boolean;
}
