import { ArrowDown } from 'lucide-react-native';
import { View } from 'react-native';

const TokenDivider = () => {
  return (
    <View className="relative z-10">
      <View className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full">
          <ArrowDown size={32} />
        </View>
      </View>
    </View>
  );
};

export default TokenDivider;
