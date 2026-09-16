import { useWindowDimensions } from 'react-native';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import TierMembershipSheetContent from './TierMembershipSheetContent';

import type { TierMembershipSheetProps } from './TierMembershipSheet.types';

const MAX_SHEET_WIDTH = 419;

const TierMembershipSheet = ({ open, onOpenChange }: TierMembershipSheetProps) => {
  const { width: windowWidth } = useWindowDimensions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        webPresentation="bottom-sheet"
        overlayClassName="web:backdrop-blur-none"
        className="max-h-[92vh] overflow-y-auto rounded-b-none rounded-t-[40px] bg-[#1C1C1C] p-0"
        style={{ width: Math.min(windowWidth, MAX_SHEET_WIDTH) }}
      >
        <DialogTitle className="sr-only">Tier membership</DialogTitle>
        <TierMembershipSheetContent onClose={() => onOpenChange(false)} topPadding={28} />
      </DialogContent>
    </Dialog>
  );
};

export default TierMembershipSheet;
