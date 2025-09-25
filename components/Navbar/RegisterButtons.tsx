import { View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const RegisterButtons = () => {
  return (
    <View className="flex-row items-center gap-2">
      <Button
        onPress={() => router.push(path.REGISTER)}
        variant="ghost"
        className="rounded-xl px-6 border-0"
      >
        <Text className="text-lg font-semibold">Log in</Text>
      </Button>

      <Button
        onPress={() => router.push(path.REGISTER)}
        variant="brand"
        className="rounded-xl px-6 border-0"
      >
        <Text className="text-lg font-semibold">Sign up</Text>
      </Button>
    </View>
  );
};

export default RegisterButtons;
