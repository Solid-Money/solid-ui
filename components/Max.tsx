import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type MaxProps = {
  onPress: () => void;
  disabled?: boolean;
};

const Max = ({ onPress, disabled }: MaxProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center justify-center rounded-xl bg-secondary px-3 py-1 disabled:opacity-50 web:hover:bg-secondary-hover"
    >
      <Text className="text-sm font-medium opacity-50">Max</Text>
    </Pressable>
  );
};

export default Max;
