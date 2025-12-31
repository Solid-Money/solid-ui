import { View } from 'react-native';
import { Text } from '@/components/ui/text';

type CoinNameProps = {
  contractName: string;
  contractTickerSymbol: string;
};

const CoinName = ({ contractName, contractTickerSymbol }: CoinNameProps) => {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xl md:text-3.5xl font-semibold">{contractName}</Text>
      <Text className="text-xl md:text-3.5xl font-medium opacity-50">{contractTickerSymbol}</Text>
    </View>
  );
};

export default CoinName;
