import { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

interface TokenDetailsProps {
  children: ReactNode;
  className?: string;
}

const TokenDetails = ({ children, className }: TokenDetailsProps) => {
  const childrenArray = Array.isArray(children) ? children : [children];

  return (
    <View className={cn('flex flex-col rounded-twice bg-card', className)}>
      {childrenArray.map((child, index) => (
        <View key={index}>
          {child}
          {index < childrenArray.length - 1 && <View className="border-b border-border/40" />}
        </View>
      ))}
    </View>
  );
};

export default TokenDetails;
