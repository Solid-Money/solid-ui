import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ExternalLink, XCircle } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { useRetryTransfiKyc, useShareTransfiKyc, useTransfiStatus } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { asTransfiError } from '@/lib/transfiErrors';
import { useTransfiStore } from '@/store/useTransfiStore';

/**
 * How many times to auto-fire the share before giving the user a manual retry.
 * The share can fail transiently (TransFi 5xx), and the poll would otherwise
 * re-trigger it forever behind a spinner.
 */
const MAX_SHARE_ATTEMPTS = 3;

/**
 * How long to keep promising "under a minute" before saying what is actually
 * happening. Most decisions land inside this; the ones that don't were leaving
 * users watching a spinner for days against a manual review, so past this the
 * screen stops predicting and offers a way out instead.
 */
const SLOW_VERIFICATION_MS = 45_000;

/**
 * Shown while TransFi verifies the shared identity. If the user still needs to
 * share (arrived here straight from the identity flow), we trigger the share
 * automatically. Polls the gating status and advances to the amount screen on
 * approval, or shows the rejection reason.
 */
export const TransfiKycPending = () => {
  const setModal = useBuyCryptoNavigation();
  const setError = useTransfiStore(state => state.setError);
  const routeToKyc = useBuyCryptoKycRoute();
  const { data: status } = useTransfiStatus({ poll: true });
  const { mutate: share, isPending: isSharing } = useShareTransfiKyc();
  const { mutateAsync: retryKyc, isPending: isRetrying } = useRetryTransfiKyc();
  const attemptsRef = useRef(0);
  const [exhausted, setExhausted] = useState(false);
  /** TransFi's hosted KYC page, once we've been given one to open. */
  const [hostedKycUrl, setHostedKycUrl] = useState<string>();
  const [hostedKycBlocked, setHostedKycBlocked] = useState(false);
  const [retryError, setRetryError] = useState<string>();
  /** Past SLOW_VERIFICATION_MS on this screen without a verdict. */
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    track(TRACKING_EVENTS.BUY_CRYPTO_KYC_PENDING_VIEWED);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_VERIFICATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // If we can share but haven't succeeded yet (e.g. just returned from the
  // identity flow), fire it. Self-limiting: the effect only re-runs while the
  // status is still can_share, and we stop after MAX_SHARE_ATTEMPTS.
  useEffect(() => {
    if (status?.status !== 'can_share' || isSharing) return;
    if (attemptsRef.current >= MAX_SHARE_ATTEMPTS) {
      setExhausted(true);
      return;
    }
    attemptsRef.current += 1;
    share(undefined, {
      onError: error => {
        const transfiError = asTransfiError(error);
        // A transient failure is what the attempt budget is for. A refusal with
        // a verdict — an incomplete profile, a country TransFi won't serve — is
        // not going to change on the third try, so show it instead of spinning.
        if (transfiError.action === 'retry') return;
        setError(transfiError, DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR);
      },
    });
  }, [status?.status, isSharing, share, setError, setModal]);

  useEffect(() => {
    if (status?.status === 'ready') {
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
    }
  }, [status?.status, setModal]);

  // The status is polled, so this fires on the transition rather than on every
  // poll that comes back rejected.
  useEffect(() => {
    if (status?.status !== 'rejected') return;
    track(TRACKING_EVENTS.BUY_CRYPTO_KYC_REJECTED, {
      reasons: status.reasons?.join(', '),
    });
  }, [status?.status, status?.reasons]);

  // TransFi couldn't use the verification we shared — the user has to verify
  // again rather than wait on a decision that will never come.
  useEffect(() => {
    if (status?.status === 'needs_kyc') {
      void routeToKyc(status.kycProvider);
    }
  }, [status?.status, status?.kycProvider, routeToKyc]);

  const handleRetry = useCallback(() => {
    track(TRACKING_EVENTS.BUY_CRYPTO_KYC_RETRY_PRESSED);
    attemptsRef.current = 0;
    setExhausted(false);
    share();
  }, [share]);

  /**
   * Open TransFi's hosted KYC. As with the payment page, it is handed off rather
   * than framed — the flow uses the camera and its own redirects, which an
   * iframe/WebView breaks, and a real browser shows the user a trusted URL.
   */
  const openHostedKyc = useCallback(async (url: string) => {
    if (Platform.OS === 'web') {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      // A null handle means a popup blocker stopped it; the user has to trigger
      // the open themselves, so the screen leads with the button instead.
      setHostedKycBlocked(!win);
      if (win) track(TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_PAGE_OPENED);
      return;
    }
    try {
      await openBrowserAsync(url);
      track(TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_PAGE_OPENED);
    } catch (error) {
      // Leave the user on this screen so the button can be tried again.
      console.error('Failed to open the TransFi verification page:', error);
      setHostedKycBlocked(true);
    }
  }, []);

  /**
   * Ask for a fresh verification. TransFi decides whether one is possible: a
   * link means "resubmit here", no link means it refused (a decision is already
   * in flight, or the rejection is terminal) and the status it returned — now in
   * the query cache — renders the right screen instead.
   */
  const handleHostedRetry = useCallback(async () => {
    track(TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_PRESSED);
    setRetryError(undefined);
    try {
      const result = await retryKyc();
      if (!result.kycUrl) {
        track(TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_UNAVAILABLE, {
          status: result.status,
        });
        return;
      }
      setHostedKycUrl(result.kycUrl);
      await openHostedKyc(result.kycUrl);
    } catch (error) {
      track(TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_FAILED);
      console.error('Failed to start the TransFi verification:', error);
      setRetryError('We couldn’t start the verification. Please try again in a moment.');
    }
  }, [retryKyc, openHostedKyc]);

  // The hosted flow has been handed to the user and is being completed outside
  // this modal. Nothing to do here but let them reopen it — the polled status
  // moves on by itself once TransFi receives the new submission. Shown for a
  // still-unshared profile as well as a rejected one: both are states the user
  // leaves by verifying with the partner directly, and dropping the screen the
  // moment the status moved would strand them with the page already open.
  if (hostedKycUrl && (status?.status === 'rejected' || status?.status === 'can_share')) {
    return (
      <View className="flex-1 gap-6">
        <View className="items-center gap-4 pt-2">
          <View className="items-center justify-center rounded-full bg-card p-5">
            <ExternalLink size={40} color="#94F27F" />
          </View>
          <View className="items-center gap-2 px-4">
            <Text className="text-center text-2xl font-bold text-primary">
              {hostedKycBlocked ? 'Open the verification page' : 'Finish verifying'}
            </Text>
            <Text className="text-center text-base text-muted-foreground">
              {hostedKycBlocked
                ? 'Your browser blocked the verification window. Open it to retake your photos.'
                : 'We’ve opened our payment partner’s verification page. Retake your photos there, then come back to this screen.'}
            </Text>
          </View>
        </View>

        <Text className="px-1 text-center text-xs text-muted-foreground">
          Keep this open — we’ll pick up the result automatically.
        </Text>

        <View className="mt-auto w-full gap-3">
          <Button
            className="h-14 rounded-2xl"
            variant={hostedKycBlocked ? 'brand' : 'secondary'}
            onPress={() => void openHostedKyc(hostedKycUrl)}
          >
            <Text
              className={
                hostedKycBlocked
                  ? 'text-base font-bold text-primary-foreground'
                  : 'text-base font-semibold text-primary'
              }
            >
              {hostedKycBlocked ? 'Open verification page' : 'Reopen verification page'}
            </Text>
          </Button>
          <Button
            className="h-12 rounded-2xl"
            variant="ghost"
            onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
          >
            <Text className="text-base font-semibold text-muted-foreground">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

  if (status?.status === 'rejected') {
    // Two very different rejections share this status: documents TransFi
    // couldn't read (fixable — offer the hosted flow) and a compliance decision
    // (nothing a second attempt changes). `canRetryKyc` is the server's answer.
    const canRetry = Boolean(status.canRetryKyc);
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center justify-center rounded-full bg-card p-6">
          <XCircle size={48} color="#F87171" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold text-primary">
            Verification unsuccessful
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {canRetry
              ? 'Our payment partner couldn’t verify the documents we shared — usually a photo that’s blurry, cropped or out of date. You can verify again with them directly.'
              : // Their decision, and it is final: "try again later" read as a
                // wait that would clear, so users kept coming back to the same
                // screen. Say what it is and where to take it.
                'Our payment partner won’t verify this account. Your Solid verification is unaffected — the rest of the app still works. Contact support if you think this is a mistake.'}
          </Text>
          {status.reasons?.length ? (
            <Text className="text-center text-sm text-muted-foreground">
              {status.reasons.join(', ')}
            </Text>
          ) : null}
          {retryError ? (
            <Text className="text-center text-sm text-red-500">{retryError}</Text>
          ) : null}
        </View>
        {canRetry ? (
          <View className="mt-auto w-full gap-3">
            <Button
              className="h-14 rounded-2xl"
              variant="brand"
              disabled={isRetrying}
              onPress={() => void handleHostedRetry()}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text className="text-base font-bold text-primary-foreground">Verify again</Text>
              )}
            </Button>
            <Button
              className="h-12 rounded-2xl"
              variant="ghost"
              onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
            >
              <Text className="text-base font-semibold text-muted-foreground">Close</Text>
            </Button>
          </View>
        ) : (
          <Button
            className="mt-auto h-14 w-full rounded-2xl"
            variant="secondary"
            onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
          >
            <Text className="text-base font-bold text-primary">Close</Text>
          </Button>
        )}
      </View>
    );
  }

  if (exhausted) {
    // A profile already exists at the partner, so re-sharing the same documents
    // is not the only move left — and for the users this screen was stranding,
    // it was the move that could never work: the partner was holding a
    // submission of its own and refusing every replacement. Verifying with them
    // directly is the way past that, so lead with it.
    const canVerifyDirectly = Boolean(status?.canRetryKyc);
    return (
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="items-center gap-2">
          <Text className="text-center text-xl font-bold text-primary">
            We couldn&apos;t finish setting this up
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {canVerifyDirectly
              ? 'Sharing your verification with our payment partner didn’t go through. Your identity check is still valid — you can verify with them directly instead.'
              : 'Sharing your verification with our payment partner didn’t go through. Your identity check is still valid — try again in a moment.'}
          </Text>
          {retryError ? (
            <Text className="text-center text-sm text-red-500">{retryError}</Text>
          ) : null}
        </View>
        <View className="mt-auto w-full gap-3">
          {canVerifyDirectly ? (
            <Button
              className="h-14 rounded-2xl"
              variant="brand"
              disabled={isRetrying}
              onPress={() => void handleHostedRetry()}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text className="text-base font-bold text-primary-foreground">
                  Verify with our partner
                </Text>
              )}
            </Button>
          ) : null}
          <Button
            className="h-14 rounded-2xl"
            variant={canVerifyDirectly ? 'secondary' : 'brand'}
            onPress={handleRetry}
          >
            <Text
              className={
                canVerifyDirectly
                  ? 'text-base font-semibold text-primary'
                  : 'text-base font-bold text-primary-foreground'
              }
            >
              Try again
            </Text>
          </Button>
          <Button
            className="h-12 rounded-2xl"
            variant="ghost"
            onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
          >
            <Text className="text-base font-semibold text-muted-foreground">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-5 px-4">
      <ActivityIndicator size="large" color="#94F27F" />
      <View className="items-center gap-2">
        <Text className="text-center text-xl font-bold text-primary">Verifying your identity</Text>
        <Text className="text-center text-base text-muted-foreground">
          {isSlow
            ? 'Our payment partner is still reviewing this. You can close this and come back — the result is saved to your account either way.'
            : 'This usually takes under a minute. You can keep this open.'}
        </Text>
      </View>
      {isSlow ? (
        <Button
          className="mt-auto h-12 w-full rounded-2xl"
          variant="ghost"
          onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
        >
          <Text className="text-base font-semibold text-muted-foreground">Close</Text>
        </Button>
      ) : null}
    </View>
  );
};

export default TransfiKycPending;
