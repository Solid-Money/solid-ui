import { ReactNode } from 'react';
import { View } from 'react-native';

interface TokenDetailsProps {
  children: ReactNode;
}

const TokenDetails = ({ children }: TokenDetailsProps) => {
  const childrenArray = Array.isArray(children) ? children : [children];

  return (
    <View className="flex flex-col bg-accent rounded-twice">
      {childrenArray.map((child, index) => (
        <View key={index}>
          {child}
          {index < childrenArray.length - 1 && <View className="border-b border-border" />}
        </View>
      ))}
    </View>
  );
};

export default TokenDetails;
