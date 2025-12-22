import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type MaxProps = {
  onPress: () => void;
};

const Max = ({ onPress }: MaxProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center gap-1 bg-secondary rounded-xl h-6 p-2 web:hover:bg-secondary-hover"
    >
      <Text className="text-sm font-medium opacity-50">Max</Text>
    </Pressable>
  );
};

export default Max;
