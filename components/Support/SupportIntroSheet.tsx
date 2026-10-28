import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';

import SupportIntroContent from './SupportIntroContent';

interface SupportIntroSheetProps {
  open: boolean;
  /** All dismissal paths finish the once-per-account introduction. */
  onClose: () => void;
}

/** Figma 28608:6226, presented by the same sheet as the card drawers. */
export default function SupportIntroSheet({ open, onClose }: SupportIntroSheetProps) {
  return (
    <CardBottomSheet
      isOpen={open}
      onOpenChange={next => !next && onClose()}
      contentKey="support-intro"
      designTop={39}
      designBottom={40}
    >
      {({ session, topPadding, presentation }) => (
        <SupportIntroContent
          key={session}
          topPadding={topPadding}
          presentation={presentation}
          onClose={onClose}
        />
      )}
    </CardBottomSheet>
  );
}
