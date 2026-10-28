import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

import ReferSheet from './ReferSheet';
import { ReferIcon } from './ReferV4Primitives';

import type { ReferShare } from './useReferShare';

const QR_SIZE = 220;
/** Keeps the rounded corners clear of the finder patterns, as on the deposit QR. */
const QR_QUIET_ZONE = 14;

interface ReferQrSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  share: ReferShare;
  surface: 'refer' | 'invites';
}

/**
 * The invite link as a QR code, for inviting someone standing next to you: they
 * scan it with their camera and land on the invite page, which carries the code
 * through the install.
 */
const ReferQrSheet = ({ isOpen, onOpenChange, share, surface }: ReferQrSheetProps) => {
  useEffect(() => {
    if (isOpen) track(TRACKING_EVENTS.REFERRAL_QR_SHOWN, { surface });
  }, [isOpen, surface]);

  return (
    <ReferSheet isOpen={isOpen} onOpenChange={onOpenChange} contentKey="referral-v4-qr">
      <Text className="mt-1 text-center text-[22px] font-semibold text-white">Scan to join</Text>
      <Text className="mt-2 text-center text-[15px] leading-[21px] text-white/60">
        Your friend scans this with their camera to open your invite.
      </Text>

      <View
        className="mt-6 items-center justify-center overflow-hidden rounded-[20px] bg-card"
        style={{ width: QR_SIZE, height: QR_SIZE }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`QR code for ${share.linkLabel}`}
      >
        {share.link ? (
          <QRCode
            value={share.link}
            size={QR_SIZE}
            color="white"
            backgroundColor="#1C1C1C"
            quietZone={QR_QUIET_ZONE}
          />
        ) : null}
      </View>

      <Pressable
        onPress={share.copy}
        accessibilityRole="button"
        accessibilityLabel="Copy your invite link"
        className="mt-4 flex-row items-center gap-1.5 active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-[15px] font-medium text-white/70">
          {share.isCopied ? 'Copied' : share.linkLabel}
        </Text>
        <ReferIcon asset="images/referral-v4/copy.svg" size={16} />
      </Pressable>

      <Pressable
        onPress={() => onOpenChange(false)}
        accessibilityRole="button"
        className="mt-6 h-[56px] w-full items-center justify-center rounded-[16px] bg-brand active:opacity-80 web:hover:opacity-90"
      >
        <Text className="text-[16px] font-semibold text-black">Done</Text>
      </Pressable>
    </ReferSheet>
  );
};

export default ReferQrSheet;
