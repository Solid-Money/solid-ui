import { View } from 'react-native';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import UpgradeTierSheetContent from './UpgradeTierSheetContent';

import type { UpgradeTierSheetProps } from './UpgradeTierSheet.types';

const UpgradeTierSheet = ({
  open,
  tier,
  onOpenChange,
  onDepositFuse,
  onBuyFuse,
}: UpgradeTierSheetProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showCloseButton={false}
      webPresentation="bottom-sheet"
      overlayClassName="web:backdrop-blur-none"
      className="h-[412px] w-full max-w-[419px] overflow-hidden rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
    >
      <DialogTitle className="sr-only">Upgrade tier</DialogTitle>
      <View className="absolute left-1/2 top-5 z-10 h-[5px] w-[73px] -translate-x-1/2 rounded-full bg-white/20" />
      <UpgradeTierSheetContent
        tier={tier}
        onDepositFuse={onDepositFuse}
        onBuyFuse={onBuyFuse}
        topPadding={61}
      />
    </DialogContent>
  </Dialog>
);

export default UpgradeTierSheet;
