import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type MaxProps = {
  onPress: () => void;
};

const Max = ({ onPress }: MaxProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="web:hover:bg-secondary-hover items-center justify-center rounded-xl bg-secondary px-3 py-1"
    >
      <Text className="text-sm font-medium opacity-50">Max</Text>
    </Pressable>
  );
};

export default Max;
