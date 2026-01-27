/**
 * QR Scanner Route - Web Fallback
 *
 * QR scanning is only available on native platforms (iOS/Android).
 * This fallback redirects web users back to the previous screen.
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';

export default function QRScannerWebFallback() {
  useEffect(() => {
    // Redirect back after a brief delay on web
    const timer = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-center text-lg text-foreground/70">
        QR scanning is only available on mobile devices.
      </Text>
    </View>
  );
}
