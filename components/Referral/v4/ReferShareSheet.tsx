import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { QrCode } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';
import { formatUsdWhole } from '@/lib/referral/referralV4';

import ReferSheet from './ReferSheet';

import type { ReferShare } from './useReferShare';

const ShareAction = ({
  icon,
  label,
  onPress,
}: {
  icon: AssetPath;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    className="items-center gap-2 active:opacity-70 web:transition-opacity web:hover:opacity-80"
  >
    <Image source={getAsset(icon)} style={{ width: 45, height: 45 }} contentFit="contain" />
    <Text className="text-[14px] text-white/70">{label}</Text>
  </Pressable>
);

interface ReferShareSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  share: ReferShare;
  friendCreditUsd: number | undefined;
  onShowQr: () => void;
}

/**
 * Every way to pass the invite on, behind the share bar's Share button: the
 * same WhatsApp / Telegram / Copy / More row today's referral popup has, and
 * the QR code for inviting someone in person.
 */
const ReferShareSheet = ({
  isOpen,
  onOpenChange,
  share,
  friendCreditUsd,
  onShowQr,
}: ReferShareSheetProps) => (
  <ReferSheet isOpen={isOpen} onOpenChange={onOpenChange} contentKey="referral-v4-share">
    <Text className="mt-1 text-center text-[22px] font-semibold text-white">Share your invite</Text>
    {friendCreditUsd ? (
      <Text className="mt-2 text-center text-[15px] leading-[21px] text-white/60">
        Friends who join with your link get {formatUsdWhole(friendCreditUsd)} to spend with their
        card.
      </Text>
    ) : null}

    <View className="mt-6 w-full flex-row items-start justify-between rounded-[20px] bg-white/[0.05] px-5 py-5">
      <ShareAction
        icon="images/referral-new-whatsapp.png"
        label="WhatsApp"
        onPress={share.shareWhatsApp}
      />
      <ShareAction
        icon="images/referral-new-telegram.png"
        label="Telegram"
        onPress={share.shareTelegram}
      />
      <ShareAction
        icon="images/referral-new-copy-link.png"
        label={share.isCopied ? 'Copied!' : 'Copy link'}
        onPress={share.copy}
      />
      <ShareAction icon="images/referral-new-more.png" label="More" onPress={share.shareNative} />
    </View>

    <Pressable
      onPress={onShowQr}
      accessibilityRole="button"
      accessibilityLabel="Show a QR code of your invite link"
      className="mt-3 h-[56px] w-full flex-row items-center justify-center gap-2 rounded-[16px] bg-white/[0.05] active:opacity-70 web:hover:bg-white/[0.08]"
    >
      <QrCode size={20} color="#FFFFFF" />
      <Text className="text-[16px] font-semibold text-white">Show QR code</Text>
    </Pressable>
  </ReferSheet>
);

export default ReferShareSheet;
