import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { CircleAlert, RefreshCw } from 'lucide-react-native';

import ErrorRefChip from '@/components/FailureSheet/ErrorRefChip';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { buildSupportMessage, ErrorReport, reportError } from '@/lib/errors';
import { openIntercomWithMessage } from '@/lib/intercom';
import { isStaleBundleError, reloadForNewBundle } from '@/lib/staleBundle';

import type { ErrorBoundaryProps } from 'expo-router';

const ErrorBoundary = ({ error, retry }: ErrorBoundaryProps) => {
  const pathname = usePathname();
  const trackedKeyRef = useRef<string | null>(null);
  const [report, setReport] = useState<ErrorReport>();
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
        // A render crash that reaches this boundary is the most severe error the
        // app produces, and it used to go to analytics only — which is why the
        // error tracker looked quieter than the app actually was. A stale bundle
        // is excluded: it is a deploy artifact, not a defect, and it recovers on
        // reload.
        if (!isStaleBundle) {
          // Reported through the shared path so the screen can show a Ref.
          void reportError(error, { action: 'generic' }, 'screen', {
            source: 'error_boundary',
            platform: Platform.OS,
          }).then(shown => setReport(shown.report));
        }
      }
    } catch {}
  }, [error, isStaleBundle, pathname]);

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

  // The layout's providers are gone when this renders, so the chat is opened
  // directly rather than through the support drawer.
  const handleSupport = useCallback(() => {
    openIntercomWithMessage(buildSupportMessage('generic', report));
  }, [report]);

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
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-[rgba(255,101,102,0.14)]">
            <CircleAlert size={30} color="#FF6566" />
          </View>
          <Text className="mb-2 text-center text-2xl font-semibold">Something went wrong</Text>
          {/* Never the raw message: it is meaningless to users and can carry
              internals. The Ref below is what support needs. */}
          <Text className="mb-4 text-center text-muted-foreground">
            This screen couldn’t load. Try again, or go home and come back.
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
          <Pressable
            accessibilityRole="button"
            onPress={handleSupport}
            className="mt-5 py-1 active:opacity-70 web:hover:opacity-80"
          >
            <Text className="text-base font-medium text-white">Contact support</Text>
          </Pressable>
          {report ? (
            <View className="mt-3">
              <ErrorRefChip errorRef={report.ref} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ErrorBoundary;
