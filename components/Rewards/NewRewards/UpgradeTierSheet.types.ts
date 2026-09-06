import { RewardsTier } from '@/lib/types';

export interface UpgradeTierSheetProps {
  open: boolean;
  remainingFuse?: number;
  tier: RewardsTier.PRIME | RewardsTier.ULTRA;
  onOpenChange: (open: boolean) => void;
  onDepositFuse: () => void;
  onBuyFuse: () => void;
}
