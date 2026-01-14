import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { Currency, Token } from '@cryptoalgebra/fuse-sdk';

import { Text } from '@/components/ui/text';
import { useAllTokens } from '@/hooks/tokens/useAllTokens';
import { getAsset } from '@/lib/assets';

interface CurrencyLogoProps {
  currency: Currency | undefined | null;
  size: number;
  style?: ViewStyle;
}

const CurrencyLogo = ({ currency, size, style = {} }: CurrencyLogoProps) => {
  const { tokens } = useAllTokens(true);

  const baseViewStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#404040',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    ...style,
  };

  const baseImageStyle: ImageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  };

  if (!currency) {
    return (
      <View
        style={[
          baseViewStyle,
          {
            backgroundColor: '#2a2a2a',
          },
        ]}
      />
    );
  }

  if (currency.isNative) {
    return (
      <Image
        source={getAsset('images/fuse.png')}
        style={baseImageStyle}
        contentFit="contain"
        alt="FUSE token icon"
      />
    );
  }

  const logoUrl = (currency as Token)?.address
    ? tokens.find(
        token => token.address.toLowerCase() === (currency as Token)?.address.toLowerCase(),
      )?.logoURI
    : undefined;

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={baseImageStyle}
        contentFit="contain"
        alt={`${currency.symbol || 'Token'} icon`}
      />
    );
  }

  return (
    <View
      style={[
        baseViewStyle,
        {
          backgroundColor: '#ffffff',
          justifyContent: 'center',
          alignItems: 'center',
        },
      ]}
    >
      <Text style={{ color: '#000000', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {currency.symbol?.slice(0, 2)}
      </Text>
    </View>
  );
};

export default CurrencyLogo;
