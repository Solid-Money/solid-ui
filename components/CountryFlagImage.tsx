import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Image, ImageStyle } from 'expo-image';

interface CountryFlagImageProps {
  isoCode: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  className?: string;
  countryName?: string;
}

/**
 * A component to display high-quality country flags using direct SVG imports
 */
const CountryFlagImage: React.FC<CountryFlagImageProps> = ({
  isoCode,
  size,
  style,
  imageStyle,
  className = '',
  countryName,
}) => {
  // Convert ISO code to lowercase
  const countryCode = isoCode.toLowerCase();

  // Create the URL for the flag from the flag-icons CDN
  const flagUrl = `https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/${countryCode}.svg`;

  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: flagUrl }}
        style={[
          {
            width: size * 1.2,
            height: size * 0.9, // Maintain aspect ratio for flags (4:3)
            resizeMode: 'cover',
          },
          imageStyle,
        ]}
        alt={countryName ? `${countryName} flag` : `${isoCode.toUpperCase()} flag`}
      />
    </View>
  );
};

export default CountryFlagImage;
