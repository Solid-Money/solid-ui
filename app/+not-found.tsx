import React from 'react';
import { View } from 'react-native';
import { Link, Stack } from 'expo-router';

import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center gap-4 bg-background">
        <Text className="text-2xl font-bold">This screen does not exist.</Text>
        <Link href={path.HOME}>
          <Text className="text-lg font-bold">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
