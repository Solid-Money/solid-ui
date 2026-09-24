import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export interface OnramperWidgetProps {
  /**
   * Called when a provider redirects back to us, on the platforms that redirect
   * at all. Advisory only — not every provider honours a redirect, so the
   * webhook stays the source of truth for whether the buy happened.
   */
  onOutcome?: (outcome: 'success' | 'failure') => void;
}

/** Height Onramper sizes the widget for; the sheet reserves it either way. */
export const ONRAMPER_WIDGET_HEIGHT = 630;
export const ONRAMPER_WIDGET_WIDTH = 420;

export const OnramperWidgetLoading = () => (
  <View className="w-full items-center justify-center" style={{ height: ONRAMPER_WIDGET_HEIGHT }}>
    <ActivityIndicator color="white" />
  </View>
);

/**
 * Shown when the URL could not be minted at all — a signed-out session, or our
 * backend refusing. Distinct from a widget that loaded and then failed, which
 * Onramper reports inside the frame.
 */
export const OnramperWidgetError = ({ onRetry }: { onRetry: () => void }) => (
  <View
    className="w-full items-center justify-center gap-y-4 px-6"
    style={{ height: ONRAMPER_WIDGET_HEIGHT }}
  >
    <Text className="text-center text-base text-white">Couldn&apos;t start the buy flow.</Text>
    <Text className="text-center text-sm text-white/60">Check your connection and try again.</Text>
    <Button variant="brand" className="h-12 rounded-full px-8" onPress={onRetry}>
      <Text className="text-base font-bold text-black">Try again</Text>
    </Button>
  </View>
);
