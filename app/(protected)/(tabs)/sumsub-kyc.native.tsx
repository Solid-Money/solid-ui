import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import {
  KycCompleted,
  KycError,
  KycLoading,
  KycUnavailable,
  useSumsubSession,
} from '@/components/kyc';

/**
 * Native Sumsub KYC screen (Wirex / EU flow). React-Native has no first-party
 * Sumsub module wired into this app, so the WebSDK is embedded in a WebView via
 * Sumsub's hosted builder script. Routing is driven by useSumsubSession's
 * backend polling (the canonical kycStatus); WebView messages are best-effort
 * accelerators.
 *
 * NOTE: token refresh on native returns the same token (short-lived); raise
 * SUMSUB_LEVEL ttl if a session outlives it. Camera access is granted to the
 * WebView (mediaCapturePermissionGrantType="grant").
 */
export default function SumsubKycNative() {
  const {
    session,
    initSession,
    markStarted,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationError,
  } = useSumsubSession();
  const startedRef = useRef(false);

  const accessToken = session.phase === 'ready' ? session.accessToken : null;

  const html = useMemo(() => (accessToken ? buildSumsubHtml(accessToken) : ''), [accessToken]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        payload?: any;
      };
      switch (msg.type) {
        case 'launched':
          if (!startedRef.current) {
            startedRef.current = true;
            markStarted();
          }
          break;
        case 'statusChanged':
          if (msg.payload?.reviewStatus === 'completed') {
            if (msg.payload?.reviewResult?.reviewAnswer === 'RED') {
              onVerificationDeclined();
            } else {
              onVerificationComplete();
            }
          }
          break;
        case 'error':
          onVerificationError(
            typeof msg.payload === 'string'
              ? msg.payload
              : (msg.payload?.error ?? 'Verification failed'),
          );
          break;
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={styles.container}>
      {session.phase === 'loading' && <KycLoading />}
      {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}
      {session.phase === 'unavailable' && (
        <KycUnavailable message={session.message} onRetry={initSession} />
      )}
      {(session.phase === 'ready' || session.phase === 'started') && html ? (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          style={styles.webview}
        />
      ) : null}
      {session.phase === 'completed' && <KycCompleted />}
    </View>
  );
}

/** Inline HTML that boots the Sumsub WebSDK with the given access token. */
function buildSumsubHtml(accessToken: string): string {
  // The token is a Sumsub `_act-…` string; JSON.stringify guards the injection.
  const token = JSON.stringify(accessToken);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>html,body,#sumsub-websdk-container{height:100%;margin:0;padding:0;}</style>
  </head>
  <body>
    <div id="sumsub-websdk-container"></div>
    <script src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"></script>
    <script>
      function post(m){ if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } }
      try {
        var instance = snsWebSdk
          .init(${token}, function(){ return Promise.resolve(${token}); })
          .withConf({ lang: 'en' })
          .withOptions({ addViewportTag: true, adaptIframeHeight: true })
          .on('idCheck.onApplicantStatusChanged', function(p){ post({ type: 'statusChanged', payload: p }); })
          .on('idCheck.onError', function(e){ post({ type: 'error', payload: e }); })
          .build();
        instance.launch('#sumsub-websdk-container');
        post({ type: 'launched' });
      } catch (e) {
        post({ type: 'error', payload: String(e) });
      }
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
