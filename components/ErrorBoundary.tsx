import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { isStaleBundleError, reloadForNewBundle } from '@/lib/staleBundle';

import type { ErrorBoundaryProps } from 'expo-router';

const ErrorBoundary = ({ error, retry }: ErrorBoundaryProps) => {
  const pathname = usePathname();
  const trackedKeyRef = useRef<string | null>(null);
  // A chunk this tab asked for is gone from the host, so "Try again" re-renders
  // straight back into the same failed import. Only a fresh document recovers it.
  const isStaleBundle = isStaleBundleError(error);

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

  const handleRetry = useCallback(() => {
    track(TRACKING_EVENTS.RETRY_ATTEMPTED, {
      error_name: error?.name,
      error_message: String(error?.message ?? ''),
      pathname,
      retry_source: 'error_boundary',
      platform: Platform.OS,
    });
    retry();
  }, [error, pathname, retry]);

  const handleReload = useCallback(() => {
    track(TRACKING_EVENTS.RETRY_ATTEMPTED, {
      error_name: error?.name,
      error_message: String(error?.message ?? ''),
      pathname,
      retry_source: 'stale_bundle_reload',
      platform: Platform.OS,
    });
    void reloadForNewBundle();
  }, [error, pathname]);

  if (isStaleBundle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-full max-w-screen-sm items-center">
            <View className="mb-5 h-16 w-16 items-center justify-center">
              <RefreshCw size={48} color="#94F27F" />
            </View>
            <Text className="mb-2 text-center text-2xl font-semibold">
              A new version of Solid is ready
            </Text>
            <Text className="mb-4 text-center text-muted-foreground">
              This tab has been open since an earlier release, so part of the app could not load.
              Reload to pick up the latest version.
            </Text>
            <Button variant="brand" className="mt-2 h-12 rounded-xl px-6" onPress={handleReload}>
              <Text className="text-base font-bold">Reload</Text>
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
              <Text className="text-base font-bold">Visit Home</Text>
            </Button>
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 px-6"
              onPress={handleRetry}
            >
              <Text className="text-base font-bold">Try again</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ErrorBoundary;
