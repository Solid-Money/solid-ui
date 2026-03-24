import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { KycCompleted, KycError, KycLoading, useDiditSession } from '@/components/kyc';

export default function KycNative() {
  const {
    session,
    initSession,
    markStarted,
    onVerificationComplete,
    onVerificationPending,
    onVerificationError,
  } = useDiditSession();

  const hasMarkedStarted = useRef(false);
  const urlRef = useRef<string | null>(null);

  // Capture the URL before phase transitions clear it
  if (session.phase === 'ready') {
    urlRef.current = session.verificationUrl;
    hasMarkedStarted.current = false;
  }

  const onLoadEnd = useCallback(() => {
    if (!hasMarkedStarted.current) {
      hasMarkedStarted.current = true;
      markStarted();
    }
  }, [markStarted]);

  const onError = useCallback(() => {
    onVerificationError('Failed to load verification page');
  }, [onVerificationError]);

  const showWebView =
    (session.phase === 'ready' || session.phase === 'started') && urlRef.current;

  return (
    <View style={styles.container}>
      {session.phase === 'loading' && <KycLoading />}
      {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}
      {session.phase === 'completed' && <KycCompleted />}

      {showWebView ? (
        <WebView
          source={{ uri: urlRef.current! }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          onLoadEnd={onLoadEnd}
          onError={onError}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});
