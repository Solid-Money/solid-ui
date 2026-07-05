import { ScrollView, useWindowDimensions } from 'react-native';

import ReferralProgramContent from '@/components/Referral/ReferralProgramContent';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ReferralProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Popup presentation of the `/referral-program` page. Shown when a whitelisted
 * user taps {@link ReferralProgramBanner} instead of navigating to the route.
 * The route (`app/(protected)/(tabs)/referral-program.tsx`) still renders the
 * same content for deep links and fallback navigation.
 */
export default function ReferralProgramModal({ isOpen, onClose }: ReferralProgramModalProps) {
  const { height } = useWindowDimensions();
  const maxHeight = Math.min(height * 0.85, 760);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent showCloseButton={false} className="overflow-hidden border-0 p-0">
        <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <ReferralProgramContent onClose={onClose} />
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
