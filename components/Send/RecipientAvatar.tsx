import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { CHAIN_ICONS } from '@/constants/chains';
import { getAsset } from '@/lib/assets';
import { SendRecipient } from '@/lib/sendRecipients';
import { getColorForTransaction } from '@/lib/utils/cardHelpers';

export function RecipientAvatar({
  recipient,
  compact = false,
}: {
  recipient: SendRecipient;
  compact?: boolean;
}) {
  const color = getColorForTransaction(recipient.name || recipient.walletAddress);
  const initials = recipient.name
    ?.trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean);
  const label = initials?.length
    ? `${initials[0]}${initials.length > 1 ? initials[initials.length - 1] : ''}`.toUpperCase()
    : undefined;
  const size = compact ? 56 : 44;
  const networkIcon = recipient.chainId ? CHAIN_ICONS[recipient.chainId] : undefined;

  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <View
        className="h-full w-full items-center justify-center rounded-full"
        style={{ backgroundColor: color.bg }}
      >
        {label ? (
          <Text className="font-medium" style={{ color: color.text, fontSize: compact ? 20 : 16 }}>
            {label}
          </Text>
        ) : (
          <Image
            source={getAsset('images/send/wallet.svg')}
            style={{ width: 28, height: 28, tintColor: color.text }}
          />
        )}
      </View>
      {compact && networkIcon ? (
        <View className="absolute -bottom-0.5 -right-0.5 h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full border-2 border-background bg-card">
          <Image source={networkIcon} style={{ width: 18, height: 18 }} contentFit="contain" />
        </View>
      ) : null}
    </View>
  );
}
