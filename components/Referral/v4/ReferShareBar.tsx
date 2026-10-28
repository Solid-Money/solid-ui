import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

import { ReferIcon } from './ReferV4Primitives';

import type { ReferShare } from './useReferShare';

interface ReferShareBarProps {
  share: ReferShare;
  code: string;
  /** Opens the share options. */
  onShare: () => void;
  /** Long-pressing Share goes straight to the QR code, for showing it in person. */
  onShowQr: () => void;
}

/**
 * "Your invite link" pinned to the bottom of the Refer screens (Figma
 * 29601:13290): the link, a copy control, and the green Share button. The
 * contract asks for the green 52pt button in both Refer states, so the white
 * pill in the no-invites frame is not used.
 */
const ReferShareBar = ({ share, code, onShare, onShowQr }: ReferShareBarProps) => {
  const prefix = share.linkLabel.endsWith(code)
    ? share.linkLabel.slice(0, share.linkLabel.length - code.length)
    : share.linkLabel;
  const hasCode = prefix !== share.linkLabel;

  return (
    <View className="w-full flex-row items-center gap-3 overflow-hidden rounded-[20px] border border-white/[0.06] bg-card py-2 pl-5 pr-2">
      <Pressable
        onPress={share.copy}
        accessibilityRole="button"
        accessibilityLabel={share.isCopied ? 'Invite link copied' : 'Copy your invite link'}
        className="min-w-0 flex-1 gap-px active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-[12px] text-white/50">
          {share.isCopied ? 'Copied' : 'Your invite link'}
        </Text>
        <View className="min-w-0 flex-row items-center gap-1.5">
          <Text className="shrink text-[16px] font-medium text-white" numberOfLines={1}>
            {hasCode ? (
              <>
                <Text className="text-[16px] font-medium text-white/70">{prefix}</Text>
                <Text className="text-[16px] font-bold text-white">{code}</Text>
              </>
            ) : (
              share.linkLabel
            )}
          </Text>
          <ReferIcon asset="images/referral-v4/copy.svg" size={16} />
        </View>
      </Pressable>

      <Pressable
        onPress={onShare}
        onLongPress={onShowQr}
        accessibilityRole="button"
        accessibilityLabel="Share your invite link"
        accessibilityHint="Long press to show a QR code"
        className="h-[52px] items-center justify-center rounded-[14px] bg-brand px-6 transition-all active:scale-95 active:opacity-80 web:hover:opacity-90"
      >
        <Text className="text-[16px] font-semibold text-black">Share</Text>
      </Pressable>
    </View>
  );
};

export default ReferShareBar;
