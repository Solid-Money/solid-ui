import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { openBrowserAsync } from 'expo-web-browser';

import { Text } from '@/components/ui/text';
import useOnramperWidget from '@/hooks/useOnramperWidget';

import {
  ONRAMPER_WIDGET_HEIGHT,
  OnramperWidgetError,
  OnramperWidgetLoading,
  type OnramperWidgetProps,
} from './OnramperWidgetStates';

/**
 * Our own scheme, which the signed URL names as the success/failure redirect.
 * Matches `scheme` in app.config.ts and ONRAMPER_APP_SCHEME on the backend.
 */
const APP_SCHEME = 'solid://';

/**
 * Native: Onramper's hosted widget in a WebView.
 *
 * `about:blank` and `about:srcdoc` belong in `originWhitelist` because
 * providers render themselves in nested frames — without them the flow simply
 * dead-ends part way in, with no error and no callback. `allowsInlineMediaPlayback`
 * is what lets camera-based KYC draw inline on iOS rather than not at all, and
 * `mediaCapturePermissionGrantType` answers the WebView's own camera prompt,
 * which is asked separately from the OS permission.
 */
export const OnramperWidget = ({ onOutcome }: OnramperWidgetProps) => {
  const { data: session, isPending, isError, refetch } = useOnramperWidget();
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);

  /**
   * Intercept our own scheme rather than letting the WebView try to navigate
   * to it — it cannot, and the flow would stall on a failed load.
   */
  const handleShouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      if (!request.url.startsWith(APP_SCHEME)) return true;

      onOutcome?.(request.url.includes('/failure') ? 'failure' : 'success');

      return false;
    },
    [onOutcome],
  );

  /**
   * The escape hatch, and not an optional one.
   *
   * Google Pay and ACH lean on browser payment APIs a WebView often lacks, and
   * they fail silently — a button that never appears, a flow that goes nowhere,
   * no error and no event. Onramper has no visibility once the user is with a
   * provider, so nothing tells us it happened. The same signed URL in a Custom
   * Tab or SFSafariViewController has the APIs, and still carries the deep-link
   * redirects, so the user lands back here.
   */
  const openInBrowser = useCallback(async () => {
    if (!session) return;

    setIsOpeningBrowser(true);
    try {
      await openBrowserAsync(session.url);
    } catch (error) {
      console.error('Failed to open the Onramper widget in a browser:', error);
    } finally {
      setIsOpeningBrowser(false);
    }
  }, [session]);

  if (isPending) return <OnramperWidgetLoading />;
  if (isError || !session) {
    return <OnramperWidgetError onRetry={() => void refetch()} />;
  }

  return (
    <View className="w-full gap-y-3">
      <View
        className="w-full overflow-hidden rounded-2xl"
        style={{ height: ONRAMPER_WIDGET_HEIGHT }}
      >
        <WebView
          source={{ uri: session.url }}
          originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled
          domStorageEnabled
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          style={{ backgroundColor: 'transparent' }}
        />
      </View>

      <Pressable
        className="h-11 items-center justify-center rounded-full"
        onPress={() => void openInBrowser()}
        disabled={isOpeningBrowser}
        accessibilityRole="button"
      >
        <Text className="text-sm font-medium text-white/70">Having trouble? Open in browser</Text>
      </Pressable>
    </View>
  );
};

export default OnramperWidget;
