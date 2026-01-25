import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

export function UnderReviewState() {
  return (
    <View className="mb-10 mt-8">
      <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] p-12">
        <View className="mb-4">
          <Image
            source={getAsset('images/kyc_under_review.png')}
            alt="KYC under review"
            style={{ width: 144, height: 144 }}
            contentFit="contain"
          />
        </View>

        <Text className="mt-6 text-2xl font-bold text-white">Your card is on its way!</Text>
        <Text className="my-3 text-center text-[#ACACAC]">
          Thanks for your submission. Your{'\n'}identity is now being verified.
        </Text>
      </View>
    </View>
  );
}
