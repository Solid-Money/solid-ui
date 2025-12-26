import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type MaxProps = {
  onPress: () => void;
};

const Max = ({ onPress }: MaxProps) => {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center bg-secondary rounded-xl px-3 py-1 web:hover:bg-secondary-hover"
    >
      <Text className="text-sm font-medium opacity-50">Max</Text>
    </Pressable>
  );
};

export default Max;
