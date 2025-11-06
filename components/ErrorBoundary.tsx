import type { ErrorBoundaryProps } from 'expo-router';
import { router, usePathname } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { path } from '@/constants/path';

const ErrorBoundary = ({ error, retry }: ErrorBoundaryProps) => {
  const pathname = usePathname();
  const trackedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const key = `${error?.name ?? 'Error'}:${error?.message ?? ''}`;
      if (key && trackedKeyRef.current !== key) {
        trackedKeyRef.current = key;
        track(TRACKING_EVENTS.ERROR_BOUNDARY, {
          name: error?.name,
          message: String(error?.message ?? ''),
          pathname,
          platform: Platform.OS,
          stack: typeof error?.stack === 'string' ? error.stack.slice(0, 1000) : undefined,
        });
      }
    } catch {}
  }, [error, pathname]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <View className="items-center max-w-screen-sm w-full">
          <View className="h-16 w-16 items-center justify-center mb-5">
            <AlertTriangle size={48} color="red" />
          </View>
          <Text className="text-2xl font-semibold mb-2 text-center">
            Oops, something went wrong
          </Text>
          <Text className="text-muted-foreground text-center mb-4" numberOfLines={3}>
            Error: {error?.message || 'An unexpected error occurred.'}
          </Text>
          <View className="flex-row gap-3 mt-2">
            <Button
              variant="brand"
              className="rounded-xl h-12 px-6"
              onPress={() => router.replace(path.HOME)}
            >
              <Text className="text-lg font-semibold">Visit Home</Text>
            </Button>
            <Button variant="secondary" className="rounded-xl h-12 px-6 border-0" onPress={retry}>
              <Text className="text-lg font-semibold">Try again</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ErrorBoundary;
