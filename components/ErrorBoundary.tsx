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
        <View className="w-full max-w-screen-sm items-center">
          <View className="mb-5 h-16 w-16 items-center justify-center">
            <AlertTriangle size={48} color="red" />
          </View>
          <Text className="mb-2 text-center text-2xl font-semibold">
            Oops, something went wrong
          </Text>
          <Text className="mb-4 text-center text-muted-foreground" numberOfLines={3}>
            Error: {error?.message || 'An unexpected error occurred.'}
          </Text>
          <View className="mt-2 flex-row gap-3">
            <Button
              variant="brand"
              className="h-12 rounded-xl px-6"
              onPress={() => router.replace(path.HOME)}
            >
              <Text className="text-lg font-semibold">Visit Home</Text>
            </Button>
            <Button variant="secondary" className="h-12 rounded-xl border-0 px-6" onPress={retry}>
              <Text className="text-lg font-semibold">Try again</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ErrorBoundary;
