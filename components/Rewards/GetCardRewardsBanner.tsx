import { Image } from 'expo-image';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

interface GetCardRewardsBannerProps {
  onGetCard: () => void;
}

const GetCardRewardsBanner = ({ onGetCard }: GetCardRewardsBannerProps) => {
  return (
    <View className="relative w-full overflow-hidden rounded-twice bg-card">
      <View className="flex-row items-center justify-between px-8 py-12">
        <View className="flex-1 gap-6 pr-4">
          <View className="gap-2">
            <Text className="text-base font-medium text-[#94F27F]/70">
              Get started with the Solid card
            </Text>
            <Text className="text-3xl font-bold text-white">
              Earn 3% cashback on your purchases
            </Text>
            <Text className="text-base text-white/70 mt-3">
              Use your Vault balance to spend with your Cash{'\n'}card. Repay anytime - no
              minimums.
            </Text>
          </View>

          <View className="flex-row items-center gap-6">
            <Button variant="brand" className="h-12 px-10 rounded-xl" onPress={onGetCard}>
              <Text className="text-base font-bold">Get your card</Text>
            </Button>
          </View>
        </View>

        <View className="mr-6 hidden md:flex">
          <Image
            source={getAsset('images/activate_card_steps.png')}
            style={{
              width: 300,
              height: 180,
            }}
            contentFit="contain"
          />
        </View>
      </View>
    </View>
  );
};

export default GetCardRewardsBanner;
