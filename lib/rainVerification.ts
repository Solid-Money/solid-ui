import { Linking, Platform } from 'react-native';

import { path } from '@/constants/path';

/** Open Rain external verification URL with redirect back to app. */
export function redirectToRainVerification(
  link: { url: string; params: Record<string, string> },
  redirectBackPath: string = String(path.CARD_ACTIVATE),
): void {
  const redirectBack = process.env.EXPO_PUBLIC_BASE_URL
    ? `${process.env.EXPO_PUBLIC_BASE_URL}${redirectBackPath}`
    : redirectBackPath;
  const u = new URL(link.url);
  Object.entries(link.params).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set('redirect', redirectBack);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = u.toString();
  } else {
    Linking.openURL(u.toString());
  }
}
