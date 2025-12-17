import { KycStatus } from '@/lib/types';

export interface Step {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  buttonText?: string;
  onPress?: () => void;
  status?: 'pending' | 'completed';
  kycStatus?: KycStatus;
}
