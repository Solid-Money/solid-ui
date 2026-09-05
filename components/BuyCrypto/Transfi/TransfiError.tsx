import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Clock, LifeBuoy, ShieldAlert, XCircle } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBuyCryptoKycRoute } from '@/hooks/useBuyCryptoKycRoute';
import { track } from '@/lib/analytics';
import {
  canCompleteProfile,
  type TransfiError as TransfiErrorType,
  transfiErrorTitle,
} from '@/lib/transfiErrors';
import { useTransfiStore } from '@/store/useTransfiStore';

const SUPPORT_EMAIL = 'support@solid.xyz';

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
  const reset = useTransfiStore(state => state.reset);
  const routeToKyc = useBuyCryptoKycRoute();

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

  const Icon = ICON_BY_ACTION[error.action];
  const primary = resolvePrimaryAction(error);

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
    }
  };

  const limits = describeLimits(error);

  return (
    <View className="flex-1 gap-6">
      <View className="items-center gap-4 pt-2">
        <View className="items-center justify-center rounded-full bg-card p-5">
          <Icon size={40} color={error.action === 'wait' ? '#94F27F' : '#F87171'} />
        </View>
        <View className="items-center gap-2 px-2">
          <Text className="text-center text-2xl font-bold text-primary">
            {transfiErrorTitle(error)}
          </Text>
          <Text className="text-center text-base text-muted-foreground">{error.message}</Text>
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
          <Button className="h-14 rounded-2xl" variant="brand" onPress={handlePrimary}>
            <Text className="text-base font-bold text-primary-foreground">{primary.label}</Text>
          </Button>
        ) : null}
        <Button className="h-14 rounded-2xl" variant={primary ? 'ghost' : 'brand'} onPress={goHome}>
          <Text
            className={
              primary
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
  key: 'retry' | 'amount' | 'payment_method' | 'profile' | 'kyc';
  label: string;
};

/**
 * The one thing that would actually fix this failure, or nothing when there
 * isn't one. A "Try again" button on an unsupported country is worse than no
 * button: it invites the user to keep hitting the same wall.
 */
const resolvePrimaryAction = (error: TransfiErrorType): PrimaryAction | undefined => {
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
