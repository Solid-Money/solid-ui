import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Token } from '@/lib/types';
import { cn } from '@/lib/utils';

const TokenSelectorFooter = ({ selectedToken }: { selectedToken: Token }) => {
  const instructions = [
    {
      text: `Only deposit ${selectedToken.symbol} on Ethereum. Deposits of other assets or from other networks could be lost.`,
    },
    {
      text: 'Allow a few minutes for processing',
      className: 'items-center',
    },
  ];

  return (
    <View className="gap-2">
      {instructions.map((instruction, index) => (
        <View key={index} className={cn('flex-row items-start gap-2', instruction.className)}>
          <View className="h-6 w-6 rounded-full bg-primary/10"></View>
          <Text className="text-sm text-muted-foreground">{instruction.text}</Text>
        </View>
      ))}
    </View>
  );
};

export default TokenSelectorFooter;
