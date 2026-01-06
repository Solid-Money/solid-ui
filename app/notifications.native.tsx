import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';

export default function Notifications() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      await registerForPushNotificationsAsync();
    } catch (error) {
      console.error('Notification registration failed:', error);
    } finally {
      setIsLoading(false);
      router.replace(path.HOME);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background text-foreground">
      <View className="flex-1 px-6">
        <View className="mb-8 items-center gap-4">
          <Text className="px-4 text-center text-lg font-medium leading-6 text-gray-300">
            Allow Solid to send you notifications about your transactions, price movements, new
            features and more
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 items-center justify-center gap-8">
          {/* Main image with notification previews */}
          <Image
            source={getAsset('images/grant_notifications.png')}
            alt="Grant notifications"
            style={{ width: 320, height: 360 }}
            contentFit="contain"
          />
        </View>

        {/* Continue button */}
        <View className="pb-12 pt-8">
          <Button
            variant="brand"
            className="h-16 w-full rounded-xl"
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text className="text-lg font-bold">{isLoading ? 'Loading...' : 'Continue'}</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
