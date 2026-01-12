import { ArrowDown } from 'lucide-react-native';
import { View } from 'react-native';

export default function ArrowDivider() {
  return (
    <View className="items-center justify-center py-2">
      <View className="absolute h-[1px] w-full bg-[#2C2C2C]" />
      <View className="z-10 h-9 w-9 items-center justify-center rounded-full  border-background bg-[#1C1C1C]">
        <ArrowDown color="#ACACAC" size={20} />
      </View>
    </View>
  );
}
