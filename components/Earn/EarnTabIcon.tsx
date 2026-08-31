import { View } from 'react-native';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';

interface EarnTabIconProps {
  focused: boolean;
  size?: number;
}

/** Exact three-bar glyph exported from the Earn tab in Figma. */
export const EarnTabIcon = ({ focused, size = 24 }: EarnTabIconProps) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Image
      source={getAsset('images/earn-tab.svg')}
      contentFit="contain"
      style={{ width: 24, height: 24, opacity: focused ? 1 : 0.6 }}
    />
  </View>
);
