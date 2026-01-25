import { View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

export function ActivateCardImage() {
  return (
    <View className="mt-8 items-center justify-center">
      <Image
        source={getAsset('images/activate_card_steps.png')}
        alt="Solid Card"
        style={{ width: '100%', aspectRatio: 513 / 306 }}
        contentFit="contain"
      />
    </View>
  );
}
