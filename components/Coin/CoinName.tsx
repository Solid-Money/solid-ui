import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type CoinNameProps = {
  contractName: string;
  contractTickerSymbol: string;
};

const CoinName = ({ contractName, contractTickerSymbol }: CoinNameProps) => {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="native:text-2xl text-xl font-semibold md:text-3.5xl">{contractName}</Text>
      <Text className="native:text-2xl text-xl font-medium opacity-50 md:text-3.5xl">{contractTickerSymbol}</Text>
    </View>
  );
};

export default CoinName;
