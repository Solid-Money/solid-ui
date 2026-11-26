import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRightLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

interface FuseMigrationPopupProps {
  isOpen: boolean;
  /** Closed without acting. The popup is not shown again either way; the banner stays. */
  onClose: () => void;
  /** Opens the token list. */
  onReview: () => void;
  movableUsd: number;
}

const formatUsd = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "Move your funds to Base": shown once, on the card pane, to a Wirex cardholder whose spendable
 * balance is still on Fuse. After it closes, the pane's banner is the way back in.
 */
const FuseMigrationPopup = ({ isOpen, onClose, onReview, movableUsd }: FuseMigrationPopupProps) => {
  const shownRef = useRef(false);
  useEffect(() => {
    if (!isOpen || shownRef.current) return;
    shownRef.current = true;
    track(TRACKING_EVENTS.FUSE_MIGRATION_POPUP_SHOWN, { usd: movableUsd });
  }, [isOpen, movableUsd]);

  const finish = (action: 'review' | 'later' | 'close') => {
    track(TRACKING_EVENTS.FUSE_MIGRATION_POPUP_ACTION, { action, usd: movableUsd });
    onClose();
    if (action === 'review') onReview();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && finish('close')}>
      <DialogContent
        showCloseButton={false}
        className="w-[90vw] max-w-[351px] gap-0 overflow-hidden p-0"
        style={styles.popup}
      >
        <View className="items-end px-4 pt-4">
          <DialogCloseButton className="bg-white/10" />
        </View>
        <View className="items-center gap-3 px-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#94F27F]/15">
            <ArrowRightLeft color="#94F27F" size={26} />
          </View>
          <DialogTitle className="text-center text-[24px] font-semibold text-white">
            Move your funds to Base
          </DialogTitle>
          <Text className="text-center text-base leading-[22px] text-[#ACACAC]">
            Your card now spends from Base. You have {formatUsd(movableUsd)} on Fuse. Move it with
            one tap. No fees.
          </Text>
        </View>
        <View className="w-full gap-2.5 p-6">
          <Button
            variant="brand"
            className="h-[52px] rounded-[30px]"
            onPress={() => finish('review')}
          >
            <Text className="text-base font-semibold text-black">Move to Base</Text>
          </Button>
          <Button
            variant="secondary"
            className="h-[52px] rounded-[30px] border-0 bg-[#262626]"
            onPress={() => finish('later')}
          >
            <Text className="text-base font-semibold text-white">Later</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  popup: {
    backgroundColor: '#161616',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    borderWidth: 1,
  },
});

export default FuseMigrationPopup;
