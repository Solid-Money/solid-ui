import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import type { CardActivationFailure } from '@/lib/types';

interface CardStatusBannerProps {
  isPending: boolean;
  isBlocked: boolean;
  blockedReason: string;
  /** The classified failure, when the server could name one. */
  failure?: CardActivationFailure;
}

/**
 * A blocker the user is expected to fix themselves rather than escalate.
 *
 * Everything else — an unsupported country, an issuer decline, a name the
 * issuer cannot read — is ours to resolve, so the support action is the point
 * of the card rather than a footnote.
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
    'This is a problem at our card issuer, not with your account or your verification. We are already tracking it.',
  ACTIVATION_PENDING: 'This page updates itself — there is no need to keep retrying.',
  TEMPORARY_FAILURE: 'Please try again in a few minutes.',
};

export function CardStatusBanner({
  isPending,
  isBlocked,
  blockedReason,
  failure,
}: CardStatusBannerProps) {
  // A recorded failure outranks the pending state: a card that is "on its way"
  // and an issuance that just failed are the same screen, and the failure is
  // the newer fact.
  if (failure) {
    const selfService = SELF_SERVICE_CODES.has(failure.code);
    const detail = failure.detail || FALLBACK_DETAIL_BY_CODE[failure.code];

    return (
      <View
        accessibilityRole="alert"
        className={`mb-4 rounded-xl border p-4 ${
          selfService ? 'border-yellow-500/30' : 'border-red-500/30'
        } bg-[#1C1C1C]`}
      >
        <Text className="text-base font-semibold text-white">{failure.reason}</Text>

        {!!detail && <Text className="mt-2 text-sm leading-5 text-white/70">{detail}</Text>}

        {!selfService && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contact support about card activation"
            onPress={() => openSupportDrawer()}
            className="mt-4 self-start rounded-lg bg-white/10 px-4 py-2"
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
