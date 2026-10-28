import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { buildInviteLink, inviteLinkLabel } from '@/lib/referral/inviteCode';
import { formatUsdWhole } from '@/lib/referral/referralV4';

export type ReferShareChannel = 'native' | 'whatsapp' | 'telegram' | 'copy';

const COPIED_FEEDBACK_MS = 2000;

/**
 * The user's invite link and every way of passing it on.
 *
 * One hook for the share bar, the share sheet and the QR sheet, so each of them
 * shares the same link, says the same thing, and is counted the same way.
 * `surface` says which screen the share happened on.
 */
export function useReferShare({
  code,
  friendCreditUsd,
  surface,
}: {
  code: string | undefined;
  /** What the friend gets, for the message — from the terms, never hard-coded. */
  friendCreditUsd: number | undefined;
  surface: 'refer' | 'invites';
}) {
  const [isCopied, setIsCopied] = useState(false);

  const link = useMemo(() => (code ? buildInviteLink(code) : ''), [code]);
  const linkLabel = useMemo(() => inviteLinkLabel(link), [link]);
  const message = useMemo(
    () =>
      friendCreditUsd
        ? `Join me on Solid and get ${formatUsdWhole(friendCreditUsd)} to spend with your card: ${link}`
        : `Join me on Solid: ${link}`,
    [friendCreditUsd, link],
  );

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  const trackShared = useCallback(
    (channel: ReferShareChannel) =>
      track(TRACKING_EVENTS.REFERRAL_LINK_SHARED, { channel, surface }),
    [surface],
  );

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      setIsCopied(true);
      track(TRACKING_EVENTS.REFERRAL_LINK_COPIED, { surface });
    } catch (error) {
      console.error('Failed to copy the invite link:', error);
    }
  }, [link, surface]);

  /** The OS share sheet; on web, the browser's, or a copy where there is none. */
  const shareNative = useCallback(async () => {
    if (!link) return;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : undefined;
        if (nav?.share) {
          await nav.share({ title: 'Join me on Solid', text: message, url: link });
          trackShared('native');
          return;
        }
        await copy();
        return;
      }
      const result = await Share.share({ message, url: link, title: 'Join me on Solid' });
      if (result.action === Share.sharedAction) trackShared('native');
    } catch (error) {
      // Dismissing the browser's share sheet rejects with AbortError: a decision, not a failure.
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to share the invite link:', error);
      }
    }
  }, [copy, link, message, trackShared]);

  const shareWhatsApp = useCallback(async () => {
    if (!link) return;
    const appUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      if (Platform.OS === 'web') {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      } else {
        const supported = await Linking.canOpenURL(appUrl);
        await Linking.openURL(supported ? appUrl : webUrl);
      }
      trackShared('whatsapp');
    } catch (error) {
      console.error('Failed to open WhatsApp:', error);
    }
  }, [link, message, trackShared]);

  const shareTelegram = useCallback(async () => {
    if (!link) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
      message,
    )}`;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
      trackShared('telegram');
    } catch (error) {
      console.error('Failed to open Telegram:', error);
    }
  }, [link, message, trackShared]);

  return {
    link,
    linkLabel,
    message,
    isCopied,
    copy,
    shareNative,
    shareWhatsApp,
    shareTelegram,
  };
}

export type ReferShare = ReturnType<typeof useReferShare>;
