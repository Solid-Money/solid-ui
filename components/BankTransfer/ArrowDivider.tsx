import { ArrowDown } from 'lucide-react-native';
import { View } from 'react-native';

export default function ArrowDivider() {
  return (
    <View className="z-10 -my-8 items-center" pointerEvents="none">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-[#262624]">
        <ArrowDown color="#ffffff" width={28} height={28} />
      </View>
    </View>
  );
}
