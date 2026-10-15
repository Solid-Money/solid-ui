import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';

import {
  attachPickerHtml,
  parsePickerMessage,
  type SaveBase64,
  supportFileFromPicker,
} from '@/lib/support/attachPicker';

import type { SupportFile } from '@/lib/types/support';

export interface AttachButtonProps {
  disabled?: boolean;
  onPick: (files: SupportFile[]) => void;
}

/** Whether this platform shows the button (the composer pads around it). */
export const attachAvailable = true;

/** Picked files go to the cache, where the upload reads them by uri. */
const saveToCache: SaveBase64 = (name, base64) => {
  const safe = name.replace(/[^\w.-]+/g, '_').slice(-80);
  const file = new File(
    Paths.cache,
    `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`,
  );
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
};

const couldNotRead = (name: string) =>
  Toast.show({
    type: 'error',
    text1: `Couldn't attach ${name || 'that file'}`,
    text2: 'Try picking it again.',
  });

/**
 * The app's attach button (iOS and Android): a paperclip drawn by a tiny page
 * in the in-app web view, whose file input opens the phone's own picker. See
 * lib/support/attachPicker.ts for why; the web uses AttachButton.web.tsx.
 */
export default function AttachButton({ disabled, onPick }: AttachButtonProps) {
  const [busy, setBusy] = useState(false);
  const picked = useRef<SupportFile[]>([]);
  const source = useMemo(() => ({ html: attachPickerHtml() }), []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parsePickerMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === 'start') {
        picked.current = [];
        setBusy(true);
      } else if (message.type === 'file') {
        try {
          picked.current.push(supportFileFromPicker(message, saveToCache));
        } catch {
          couldNotRead(message.name);
        }
      } else if (message.type === 'error') {
        couldNotRead(message.name);
      } else {
        const files = picked.current;
        picked.current = [];
        setBusy(false);
        if (files.length) onPick(files);
      }
    },
    [onPick],
  );

  return (
    <View
      pointerEvents={disabled || busy ? 'none' : 'auto'}
      style={[styles.box, disabled && styles.off]}
    >
      <WebView
        testID="support-attach"
        source={source}
        style={styles.page}
        containerStyle={styles.page}
        onMessage={onMessage}
        originWhitelist={['about:*', 'data:*']}
        // Only the page itself; it has no links, and nothing else may load here.
        onShouldStartLoadWithRequest={request => /^(about|data):/.test(request.url)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        textInteractionEnabled={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        hideKeyboardAccessoryView
      />
      {busy && (
        <View style={styles.cover}>
          <ActivityIndicator size="small" color="#A1A1A1" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  off: { opacity: 0.4 },
  page: { flex: 1, backgroundColor: 'transparent' },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
  },
});
