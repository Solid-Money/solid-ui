import { RewardsTier } from '@/lib/types';

export interface UpgradeTierSheetProps {
  open: boolean;
  tier: RewardsTier.PRIME | RewardsTier.ULTRA;
  onOpenChange: (open: boolean) => void;
  onDepositFuse: () => void;
  onBuyFuse: () => void;
}
