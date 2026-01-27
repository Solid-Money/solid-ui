import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import Notification from '@/assets/images/notification';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';

export default function Notifications() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

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
        {/* Header with back button */}
        <View className="flex-row items-center py-3">
          <Pressable
            onPress={handleBack}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
        </View>

        {/* Content - centered */}
        <View className="flex-1 items-center">
          {/* Bell icon with notification badge */}
          <View className="mb-8">
            <Notification width={97} height={89} />
          </View>

          {/* Title */}
          <Text className="mb-4 text-center text-[34px] font-semibold leading-[1.1] -tracking-[1px] text-white">
            Turn on notifications
          </Text>

          {/* Subtitle */}
          <Text className="text-center text-[16px] text-white/60">
            Allow Solid to send you notifications about your transactions, price movements, new
            features and more
          </Text>
        </View>

        {/* Continue button */}
        <View className="pb-12 pt-8">
          <Button
            variant="brand"
            className="h-14 w-full rounded-xl"
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text className="ml-2 text-base font-bold text-black">
              {isLoading ? 'Loading...' : 'Continue'}
            </Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
