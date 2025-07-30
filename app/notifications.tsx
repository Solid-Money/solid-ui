import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications'
import { path } from '@/constants/path'


export default function Notifications() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleContinue = async () => {
    setIsLoading(true)
    
    try {
      await registerForPushNotificationsAsync()
    } catch (error) {
      console.error('Notification registration failed:', error)
    } finally {
      setIsLoading(false)
      router.replace(path.HOME);
    }
  }

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1 px-6">
        <View className="gap-4 items-center mb-8">
          <Text className="text-center text-gray-300 text-lg leading-6 px-4 font-medium">
            Allow Solid to send you notifications about your transactions, price movements, new features and more
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 justify-center items-center gap-8">
          {/* Main image with notification previews */}
          <Image
            source={require("@/assets/images/grant_notifications.png")}
            alt="Grant notifications"
            style={{ width: 320, height: 360 }}
            contentFit="contain"
          />
        </View>

        {/* Continue button */}
        <View className="pt-8 pb-12">
          <Button
            variant="brand"
            className="rounded-xl h-16 w-full"
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text className="text-lg font-bold">
              {isLoading ? 'Loading...' : 'Continue'}
            </Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
} 