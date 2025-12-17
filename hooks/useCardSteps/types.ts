import { EndorsementStatus } from '@/components/BankTransfer/enums';

export interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  status?: 'pending' | 'completed';
  endorsementStatus?: EndorsementStatus;
}
