import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { AlertTriangle, Clock, LifeBuoy, ShieldAlert, XCircle } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { useUpgradeTransfiKyc } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import {
  asTransfiError,
  canCompleteProfile,
  kycUpgradeLevel,
  type TransfiError as TransfiErrorType,
  transfiErrorTitle,
} from '@/lib/transfiErrors';
import { TransfiKycLevel } from '@/lib/types';
import { useTransfiStore } from '@/store/useTransfiStore';

const SUPPORT_EMAIL = 'support@solid.xyz';

const UPGRADE_UNAVAILABLE_MESSAGE =
  'We couldn’t open the verification page. Please try again in a moment.';

const ICON_BY_ACTION = {
  retry: AlertTriangle,
  adjust_amount: AlertTriangle,
  change_payment_method: AlertTriangle,
  complete_kyc: ShieldAlert,
  wait: Clock,
  contact_support: LifeBuoy,
  none: XCircle,
} as const;

const formatFiat = (value: number | undefined, currency: string) =>
  value == null
    ? undefined
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

/**
 * Where a KYC upgrade stands once the user has asked for it: TransFi's page
 * handed to them (or stopped by a popup blocker, so they have to open it
 * themselves), or TransFi already reviewing a submission for that level.
 */
type UpgradeState = { state: 'opened' | 'blocked'; url: string } | { state: 'in_review' };

/**
 * Terminal screen for a buy-crypto failure.
 *
 * Every one of TransFi's refusals used to end the same way: the order call
 * 400'd, the console logged the envelope, and the user was left on the amount
 * screen with the button re-enabled and no idea why nothing happened. This says
 * what went wrong in their terms and always offers a way out — the specific one
 * where the error implies it (change the amount, finish verifying), and going
 * home where it doesn't.
 */
export const TransfiError = () => {
  const router = useRouter();
  const setModal = useBuyCryptoNavigation();
  const error = useTransfiStore(state => state.error);
  const errorOrigin = useTransfiStore(state => state.errorOrigin);
  const setError = useTransfiStore(state => state.setError);
  const reset = useTransfiStore(state => state.reset);
  const routeToKyc = useBuyCryptoKycRoute();
  const { mutateAsync: upgradeKyc, isPending: isUpgrading } = useUpgradeTransfiKyc();
  const [upgrade, setUpgrade] = useState<UpgradeState>();
  const [upgradeError, setUpgradeError] = useState<string>();

  useEffect(() => {
    if (!error) return;
    track(TRACKING_EVENTS.BUY_CRYPTO_ERROR_VIEWED, {
      code: error.code,
      action: error.action,
      status: error.status,
    });
  }, [error]);

  const goHome = () => {
    track(TRACKING_EVENTS.BUY_CRYPTO_ERROR_ACTION_PRESSED, {
      code: error?.code,
      choice: 'home',
    });
    reset();
    setModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.HOME);
  };

  // Nothing to render — treat it as a stale step rather than an empty modal.
  if (!error) {
    return (
      <View className="flex-1 justify-end">
        <Button className="h-14 rounded-2xl" variant="brand" onPress={goHome}>
          <Text className="text-base font-bold text-primary-foreground">Go to home</Text>
        </Button>
      </View>
    );
  }

  const upgradeLevel = kycUpgradeLevel(error);
  const inReview = upgrade?.state === 'in_review';
  const Icon = inReview ? Clock : ICON_BY_ACTION[error.action];
  const primary = resolvePrimaryAction(error, upgrade);

  /**
   * Hand TransFi's verification page to the browser rather than framing it — as
   * with the hosted retry, the flow uses the camera and its own redirects.
   */
  const openVerificationPage = async (url: string) => {
    let opened = false;
    if (Platform.OS === 'web') {
      // A null handle means a popup blocker stopped it; the screen then leads
      // with a button so the user can open it themselves.
      opened = Boolean(window.open(url, '_blank', 'noopener,noreferrer'));
    } else {
      try {
        await openBrowserAsync(url);
        opened = true;
      } catch (openError) {
        console.error('Failed to open the TransFi verification page:', openError);
      }
    }
    setUpgrade({ state: opened ? 'opened' : 'blocked', url });
    if (opened) track(TRACKING_EVENTS.BUY_CRYPTO_KYC_UPGRADE_PAGE_OPENED, { code: error.code });
  };

  /**
   * Ask TransFi for its page for the level this refusal names. A refusal with a
   * verdict of its own — an account TransFi won't serve, no profile to upgrade —
   * replaces this screen's error; anything transient stays inline so the button
   * can be pressed again.
   */
  const startUpgrade = async (level: TransfiKycLevel) => {
    setUpgradeError(undefined);
    try {
      const result = await upgradeKyc(level);
      if (result.status === 'pending') {
        track(TRACKING_EVENTS.BUY_CRYPTO_KYC_UPGRADE_IN_REVIEW, { level: result.level });
        setUpgrade({ state: 'in_review' });
        return;
      }
      if (!result.kycUrl) {
        setUpgradeError(UPGRADE_UNAVAILABLE_MESSAGE);
        return;
      }
      await openVerificationPage(result.kycUrl);
    } catch (upgradeFailure) {
      const failure = asTransfiError(upgradeFailure);
      track(TRACKING_EVENTS.BUY_CRYPTO_KYC_UPGRADE_FAILED, {
        code: failure.code,
        action: failure.action,
      });
      if (failure.action === 'retry') {
        setUpgradeError(UPGRADE_UNAVAILABLE_MESSAGE);
        return;
      }
      setUpgrade(undefined);
      setError(failure, errorOrigin ?? undefined);
    }
  };

  const handlePrimary = () => {
    if (!primary) return;
    track(TRACKING_EVENTS.BUY_CRYPTO_ERROR_ACTION_PRESSED, {
      code: error.code,
      choice: primary.key,
    });
    switch (primary.key) {
      case 'retry':
        // Back to whichever step raised this. A share that failed on a 5xx has
        // to be shared again; sending it to the amount screen would only fail
        // there on the KYC gate.
        setModal(errorOrigin ?? DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
        break;
      case 'amount':
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
        break;
      case 'payment_method':
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PAYMENT_METHOD);
        break;
      case 'profile':
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_PROFILE);
        break;
      case 'kyc':
        void routeToKyc();
        break;
      case 'upgrade':
        if (upgradeLevel) void startUpgrade(upgradeLevel);
        break;
      case 'reopen_upgrade':
        if (upgrade && upgrade.state !== 'in_review') void openVerificationPage(upgrade.url);
        break;
    }
  };

  // The limits only cap this purchase, so a smaller one still goes through
  // while the next KYC level is outstanding.
  const buySmallerAmount = () => {
    track(TRACKING_EVENTS.BUY_CRYPTO_ERROR_ACTION_PRESSED, {
      code: error.code,
      choice: 'smaller_amount',
    });
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
  };

  const limits = describeLimits(error);
  const title = inReview ? 'Verification in review' : transfiErrorTitle(error);
  const message = upgradeMessage(upgrade) ?? error.message;
  const hasSecondary = Boolean(upgradeLevel);

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-4 pt-2">
        <View className="items-center justify-center rounded-full bg-card p-5">
          <Icon size={40} color={inReview || error.action === 'wait' ? '#94F27F' : '#F87171'} />
        </View>
        <View className="items-center gap-2 px-2">
          <Text className="text-center text-2xl font-bold text-primary">{title}</Text>
          <Text className="text-center text-base text-muted-foreground">{message}</Text>
          {upgradeError ? (
            <Text className="text-center text-sm text-red-500">{upgradeError}</Text>
          ) : null}
        </View>
      </View>

      {limits ? (
        <View className="rounded-2xl bg-card p-4">
          <Text className="text-center text-sm text-muted-foreground">{limits}</Text>
        </View>
      ) : null}

      {error.details.missing?.length ? (
        <View className="gap-2 rounded-2xl bg-card p-4">
          <Text className="text-sm font-semibold text-muted-foreground">What’s missing</Text>
          {error.details.missing.map(field => (
            <Text key={field} className="text-base capitalize text-primary">
              {field}
            </Text>
          ))}
        </View>
      ) : null}

      {error.action === 'contact_support' ? (
        <Text className="px-1 text-center text-xs text-muted-foreground">
          Contact us at {SUPPORT_EMAIL} and quote the time of this attempt.
        </Text>
      ) : null}

      <View className="mt-auto gap-3">
        {primary ? (
          <Button
            className="h-14 rounded-2xl"
            variant="brand"
            disabled={isUpgrading}
            onPress={handlePrimary}
          >
            {isUpgrading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text className="text-base font-bold text-primary-foreground">{primary.label}</Text>
            )}
          </Button>
        ) : null}
        {hasSecondary ? (
          <Button
            className="h-14 rounded-2xl"
            variant={primary ? 'secondary' : 'brand'}
            onPress={buySmallerAmount}
          >
            <Text
              className={
                primary
                  ? 'text-base font-semibold text-primary'
                  : 'text-base font-bold text-primary-foreground'
              }
            >
              Buy a smaller amount
            </Text>
          </Button>
        ) : null}
        <Button
          className="h-14 rounded-2xl"
          variant={primary || hasSecondary ? 'ghost' : 'brand'}
          onPress={goHome}
        >
          <Text
            className={
              primary || hasSecondary
                ? 'text-base font-semibold text-muted-foreground'
                : 'text-base font-bold text-primary-foreground'
            }
          >
            Go to home
          </Text>
        </Button>
      </View>
    </View>
  );
};

type PrimaryAction = {
  key: 'retry' | 'amount' | 'payment_method' | 'profile' | 'kyc' | 'upgrade' | 'reopen_upgrade';
  label: string;
};

/**
 * The one thing that would actually fix this failure, or nothing when there
 * isn't one. A "Try again" button on an unsupported country is worse than no
 * button: it invites the user to keep hitting the same wall.
 */
const resolvePrimaryAction = (
  error: TransfiErrorType,
  upgrade: UpgradeState | undefined,
): PrimaryAction | undefined => {
  // A limit refusal: the next KYC level is on TransFi's own page. Our identity
  // flow would only find the user already verified and send them back here.
  if (kycUpgradeLevel(error)) {
    if (!upgrade) return { key: 'upgrade', label: 'Verify identity' };
    if (upgrade.state === 'in_review') return undefined;
    return {
      key: 'reopen_upgrade',
      label: upgrade.state === 'blocked' ? 'Open verification page' : 'Reopen verification page',
    };
  }
  switch (error.action) {
    case 'adjust_amount':
      return { key: 'amount', label: 'Change amount' };
    case 'change_payment_method':
      return { key: 'payment_method', label: 'Choose another method' };
    case 'retry':
      return { key: 'retry', label: 'Try again' };
    case 'complete_kyc':
      // Only offer the form when the missing pieces are ones a user can supply;
      // otherwise the identity flow is the only real route forward.
      return canCompleteProfile(error)
        ? { key: 'profile', label: 'Complete your details' }
        : { key: 'kyc', label: 'Verify identity' };
    case 'wait':
    case 'contact_support':
    case 'none':
      return undefined;
  }
};

/** What the screen says once the upgrade has been asked for; the server's copy before that. */
const upgradeMessage = (upgrade: UpgradeState | undefined): string | undefined => {
  switch (upgrade?.state) {
    case 'in_review':
      return 'Your verification is in review. You can still buy smaller amounts in the meantime.';
    case 'opened':
      return 'We’ve opened our payment partner’s verification page. Once you’ve submitted your details there, they’ll review them. You can still buy smaller amounts in the meantime.';
    case 'blocked':
      return 'Your browser blocked the verification window. Open it to upgrade your KYC.';
    default:
      return undefined;
  }
};

/** "Enter between 22 EUR and 86,351.62 EUR", when the failure carried limits. */
const describeLimits = (error: TransfiErrorType): string | undefined => {
  const { minLimit, maxLimit, fiatCurrency } = error.details;
  if (!fiatCurrency) return undefined;
  const min = formatFiat(minLimit, fiatCurrency);
  const max = formatFiat(maxLimit, fiatCurrency);
  if (min && max) return `Enter between ${min} and ${max}.`;
  if (min) return `The minimum is ${min}.`;
  if (max) return `The maximum is ${max}.`;
  return undefined;
};

export default TransfiError;
