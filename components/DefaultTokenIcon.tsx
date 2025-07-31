import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const DefaultTokenIcon = ({ size = 24, symbol = '?' }: { size?: number; symbol?: string }) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#6366f1', // Nice purple color
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
      }}
    >
      <Text
        style={{
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {symbol.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

export default DefaultTokenIcon;
