import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

import type { CategoryCashbackBrand } from './categoryCashbackBrands';

const CategoryCashbackBrandBadge = ({ brand }: { brand: CategoryCashbackBrand }) => (
  <View style={{ width: 30, height: 30 }}>
    {brand.background && (
      <View
        style={{
          position: 'absolute',
          width: brand.background.size ?? 30,
          height: brand.background.size ?? 30,
          left: brand.background.left ?? 0,
          top: brand.background.top ?? 0,
          backgroundColor: brand.background.color,
          borderRadius: brand.background.radius ?? 15,
        }}
      />
    )}
    {brand.layers.map(({ source, flipY, ...geometry }, index) => (
      <Image
        key={index}
        source={source}
        style={{
          position: 'absolute',
          ...geometry,
          ...(flipY ? { transform: [{ scaleY: -1 }] } : {}),
        }}
        contentFit="contain"
      />
    ))}
    {brand.ring && (
      <Image
        source={
          brand.ring === 'rides'
            ? require('@/assets/images/subscription-cashback/ride-ring.svg')
            : require('@/assets/images/subscription-cashback/airline-ring.svg')
        }
        style={{ position: 'absolute', width: 30, height: 30 }}
        contentFit="contain"
      />
    )}
    {brand.badgeText && (
      <Text
        className="absolute text-white/70"
        style={{
          left: 6.35,
          top: 6.92,
          fontFamily: 'MonaSans_500Medium',
          fontSize: 13.846,
          lineHeight: 15.23,
        }}
      >
        {brand.badgeText}
      </Text>
    )}
  </View>
);

export default CategoryCashbackBrandBadge;
