import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

interface RewardReferBannerProps {
  title?: string;
  buttonText?: string;
}

export default function RewardReferBanner({
  title = 'Invite friends & earn together',
  buttonText = 'Refer a friend',
}: RewardReferBannerProps) {
  const { isScreenMedium } = useDimension();

  return (
    <View className="h-full w-full flex-1 flex-col justify-between rounded-twice bg-card p-6">
      <View className="flex-row items-center gap-2">
        <Image
          source={getAsset('images/refer_friend.png')}
          style={{ width: isScreenMedium ? 90 : 70, height: isScreenMedium ? 90 : 70 }}
          contentFit="contain"
        />
        <View className="ml-2 flex-1 flex-col md:ml-5">
          <Text className="text-xl font-semibold md:text-2xl">{title}</Text>
          <Text className="text-base text-white/70 md:text-lg">
            Earn $15 when a friend orders a card &amp; spends.
          </Text>
        </View>
      </View>
      <Button
        variant="secondary"
        className="mt-7 h-10 rounded-xl border-0 bg-[#303030] px-6 md:h-12"
        onPress={() => {
          router.push(path.REFERRAL);
        }}
      >
        <View className="flex-row items-center gap-4">
          <Text className="font-bold">{buttonText}</Text>
        </View>
      </Button>
    </View>
  );
}
