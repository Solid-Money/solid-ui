import { ArrowDown } from 'lucide-react-native';
import { View } from 'react-native';

export default function ArrowDivider() {
  return (
    <View className="items-center -my-8 z-10" pointerEvents="none">
      <View className="w-12 h-12 rounded-full bg-[#262624] items-center justify-center">
        <ArrowDown color="#ffffff" width={26} height={26} />
      </View>
    </View>
  );
}
