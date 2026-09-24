import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { isActivationFailureRetryable } from '@/lib/utils/cardActivationRetry';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import type { CardActivationFailure } from '@/lib/types';

interface CardStatusBannerProps {
  isPending: boolean;
  isBlocked: boolean;
  blockedReason: string;
  /** The classified failure, when the server could name one. */
  failure?: CardActivationFailure;
  /**
   * Starts the activation flow again — the same destination as the "Activate
   * card" step. Rendered as the banner's primary action whenever the failure is
   * retryable, because on a retryable failure this IS the next step and the
   * steps list below is collapsed behind a disabled-looking row.
   */
  onRetry?: () => void;
}

/**
 * A blocker the user is expected to wait out rather than escalate.
 *
 * Only these two suppress the support action outright. Everything else offers
 * support, and a retryable failure offers a retry alongside it — an issuer
 * decline is ours to chase, but it is also the one the user can simply try
 * again once the issuer is back.
 */
const SELF_SERVICE_CODES = new Set(['ACTIVATION_PENDING', 'TEMPORARY_FAILURE']);

/**
 * Fallback explanations, used only when the server sent a reason with no detail.
 *
 * The server writes the full explanation and this screen renders it, so these
 * are not the normal path — they cover rows recorded before failures were
 * classified, which carry prose and nothing else. Duplicating the detail here
 * would print the same sentence twice.
 */
const FALLBACK_DETAIL_BY_CODE: Record<string, string> = {
  COUNTRY_NOT_SUPPORTED:
    'Our card issuer does not operate in the country your verified documents are registered in. Retrying will not change this, and your savings are unaffected.',
  DOCUMENT_COUNTRY_MISMATCH:
    'The country on your verified documents decides card eligibility, and it cannot be changed by re-selecting a country in the app. Your savings are unaffected.',
  VERIFICATION_REQUIRED:
    'Our card issuer needs a further verification step before it can open a card account.',
  MISSING_VERIFIED_NAME: 'This has to be corrected on our side — retrying will not fix it.',
  INVALID_PROFILE_DATA: 'This has to be corrected on our side — retrying will not fix it.',
  ISSUER_DECLINED:
    'This was a problem at our card issuer, not with your account or your verification. Please try again — if it keeps failing, contact support.',
  ACTIVATION_PENDING: 'This page updates itself — there is no need to keep retrying.',
  TEMPORARY_FAILURE: 'Please try again in a few minutes.',
};

export function CardStatusBanner({
  isPending,
  isBlocked,
  blockedReason,
  failure,
  onRetry,
}: CardStatusBannerProps) {
  // A recorded failure outranks the pending state: a card that is "on its way"
  // and an issuance that just failed are the same screen, and the failure is
  // the newer fact.
  if (failure) {
    const selfService = SELF_SERVICE_CODES.has(failure.code);
    const detail = failure.detail || FALLBACK_DETAIL_BY_CODE[failure.code];
    // ACTIVATION_PENDING is the one retryable code with nothing to press: the
    // card account is mid-provisioning and the page polls itself, so a button
    // would only invite the retry loop the copy is talking the user out of.
    const canRetry =
      Boolean(onRetry) &&
      failure.code !== 'ACTIVATION_PENDING' &&
      isActivationFailureRetryable(failure);

    return (
      <View
        accessibilityRole="alert"
        className={`mb-4 rounded-xl border p-4 ${
          selfService ? 'border-yellow-500/30' : 'border-red-500/30'
        } bg-[#1C1C1C]`}
      >
        <Text className="text-base font-semibold text-white">{failure.reason}</Text>

        {!!detail && <Text className="mt-2 text-sm leading-5 text-white/70">{detail}</Text>}

        {canRetry && (
          <Button
            variant="brand"
            accessibilityRole="button"
            accessibilityLabel="Try activating your card again"
            onPress={onRetry}
            className="mt-4 self-start px-5"
          >
            <Text className="text-base font-semibold text-black">Try again</Text>
          </Button>
        )}

        {/* Support stays available next to a retry, not instead of it: an issuer
            decline is still ours to chase if trying again does not clear it. */}
        {!selfService && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contact support about card activation"
            onPress={() => openSupportDrawer()}
            className={`self-start rounded-lg bg-white/10 px-4 py-2 ${canRetry ? 'mt-3' : 'mt-4'}`}
          >
            <Text className="text-sm font-semibold text-white">Contact support</Text>
          </Pressable>
        )}

        {/* The code is what support asks for first; showing it saves a round trip. */}
        <Text className="mt-3 text-xs text-white/40">Reference: {failure.code}</Text>
      </View>
    );
  }

  if (isPending) {
    return (
      <View className="mb-4 rounded-xl border border-yellow-500/30 bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold text-white">Your card is on its way</Text>
        <Text className="mt-2 text-sm text-white/70">
          We&rsquo;re finishing up your card. This may take some time.
        </Text>
      </View>
    );
  }

  if (isBlocked) {
    return (
      <View
        accessibilityRole="alert"
        className="mb-4 rounded-xl border border-red-500/30 bg-[#1C1C1C] p-4"
      >
        <Text className="text-base font-semibold text-white">Card activation rejected</Text>
        <Text className="mt-2 text-sm leading-5 text-white/70">{blockedReason}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contact support about card activation"
          onPress={() => openSupportDrawer()}
          className="mt-4 self-start rounded-lg bg-white/10 px-4 py-2"
        >
          <Text className="text-sm font-semibold text-white">Contact support</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}
