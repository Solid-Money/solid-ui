import { Currency, Token } from '@cryptoalgebra/fuse-sdk';
import React from 'react';
import { Image, ImageStyle, View, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { useAllTokens } from '@/hooks/tokens/useAllTokens';

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
        source={require('@/assets/images/fuse.png')}
        style={baseImageStyle}
        resizeMode="contain"
      />
    );
  }

  const logoUrl = (currency as Token)?.address
    ? tokens.find(token => token.address === (currency as Token)?.address)?.logoURI
    : undefined;

  if (logoUrl) {
    return <Image source={{ uri: logoUrl }} style={baseImageStyle} resizeMode="contain" />;
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
