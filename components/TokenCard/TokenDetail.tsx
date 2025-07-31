import { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

interface TokenDetailProps {
  children: ReactNode;
  className?: string;
}

const TokenDetail = ({ children, className = '' }: TokenDetailProps) => {
  return <View className={cn('p-6 md:p-5', className)}>{children}</View>;
};

export default TokenDetail;
