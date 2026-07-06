import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

type StockLogoProps = {
  ticker: string;
  logoColor: string;
  logoUrl?: string;
  size?: number;
};

export default function StockLogo({ ticker, logoColor, logoUrl, size = 40 }: StockLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = ticker.replace(/x$/i, '').slice(0, 2);
  const showImage = !!logoUrl && !imgFailed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: logoColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImgFailed(true)}
          contentFit="cover"
        />
      ) : (
        <Text
          style={{
            color: 'white',
            fontSize: size * 0.32,
            fontWeight: '700',
            lineHeight: size * 0.4,
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
