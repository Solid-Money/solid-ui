import { View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const RegisterButtons = () => {
  return (
    <View className="flex-row items-center gap-2">
      <Button
        onPress={() => router.push(path.HOME)}
        variant="ghost"
        className="rounded-xl border-0 px-6"
      >
        <Text className="text-lg font-semibold">Log in</Text>
      </Button>

      <Button
        onPress={() => router.push(path.HOME)}
        variant="brand"
        className="rounded-xl border-0 px-6"
      >
        <Text className="text-lg font-semibold">Sign up</Text>
      </Button>
    </View>
  );
};

export default RegisterButtons;
