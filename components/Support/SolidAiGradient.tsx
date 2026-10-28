import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { solidAiGradientHtml } from './solidAiGradientRenderer';

/** The local GPU canvas uses the avatar's actual size, including small chat avatars. */
export default function SolidAiGradient({ size, still }: { size: number; still: boolean }) {
  const source = useMemo(() => ({ html: solidAiGradientHtml(still, size) }), [size, still]);
  return (
    <WebView
      source={source}
      style={styles.canvas}
      containerStyle={StyleSheet.absoluteFill}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      androidLayerType="hardware"
      originWhitelist={['about:blank']}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      pointerEvents="none"
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({ canvas: { backgroundColor: '#0A160C' } });
