import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function KycLoading() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#94F27F" />
      <Text className="mt-4 text-center text-[#ACACAC]">Preparing verification...</Text>
    </View>
  );
}

export function KycError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-20">
      <Text className="text-center text-red-400">{message}</Text>
      <Button variant="brand" onPress={onRetry} className="h-12 rounded-xl px-8">
        <Text className="font-semibold text-primary-foreground">Try again</Text>
      </Button>
    </View>
  );
}

/**
 * Shown when session creation fails because identity verification is
 * temporarily unavailable (backend VERIFICATION_UNAVAILABLE — depleted Didit
 * credit). Distinct from KycError: this is a transient, not-your-fault state,
 * so it reads calmer (no red) and nudges the user to retry later.
 */
export function KycUnavailable({
  message,
  onRetry,
  showBackButton = true,
}: {
  message?: string;
  onRetry: () => void;
  /** Render a back button at the top-left. Off on web, where the page header already has one. */
  showBackButton?: boolean;
}) {
  const body =
    message ??
    'We can’t start identity verification right now. Please try again in a little while.';
  return (
    <View className="flex-1">
      {showBackButton && (
        <View className="px-4 pt-2">
          <BackButton />
        </View>
      )}
      <View className="flex-1 items-center justify-center gap-4 px-8 pb-20">
        <Text className="text-center text-lg font-semibold text-white">
          Verification temporarily unavailable
        </Text>
        <Text className="text-center text-[#ACACAC]">{body}</Text>
        <Button variant="brand" onPress={onRetry} className="h-12 rounded-xl px-8">
          <Text className="font-semibold text-primary-foreground">Try again</Text>
        </Button>
        <Text className="text-center text-xs text-[#6B6B6B]">
          If this keeps happening, contact support.
        </Text>
      </View>
    </View>
  );
}

/**
 * How the KYC screen is being left. The distinction is not cosmetic: a 409
 * KYC_ALREADY_EXISTS ('existing') is not a pass, and reporting it as
 * "Verification complete!" told users with an expired session and a rejected
 * selfie that they were verified.
 */
export type KycHandoffOutcome = 'approved' | 'submitted' | 'declined' | 'existing';

const HANDOFF_COPY: Record<KycHandoffOutcome, { title: string; body: string; tone: string }> = {
  approved: {
    title: 'Verification complete!',
    body: 'Redirecting...',
    tone: 'text-[#94F27F]',
  },
  submitted: {
    title: 'Verification submitted',
    body: 'Taking you to the next step...',
    tone: 'text-[#94F27F]',
  },
  declined: {
    title: 'Verification declined',
    body: 'Taking you back so you can review the details...',
    tone: 'text-red-400',
  },
  existing: {
    title: 'Verification already on file',
    body: 'We already have an identity check for you. Taking you back...',
    tone: 'text-white',
  },
};

/** How long to wait for the redirect before offering a manual way out. */
const HANDOFF_FALLBACK_MS = 3000;

/**
 * Hand-off interstitial shown while the user is routed off the KYC screen.
 *
 * The manual button is the point: this screen used to render nothing but text,
 * so a navigation that did not land stranded the user on "Redirecting..."
 * indefinitely — with no button, and on native (which has no header) no back
 * affordance either. Re-entering the flow then landed straight back here,
 * because the tab screen stays mounted and its session state is never re-run.
 */
export function KycCompleted({
  outcome = 'approved',
  onContinue,
  showBackButton = false,
}: {
  outcome?: KycHandoffOutcome;
  /** Re-issues the redirect. Revealed once the automatic one looks stuck. */
  onContinue?: () => void;
  /** Render a back button at the top-left. Off on web, which has a page header. */
  showBackButton?: boolean;
}) {
  const [showFallback, setShowFallback] = useState(false);
  const { title, body, tone } = HANDOFF_COPY[outcome];

  useEffect(() => {
    if (!onContinue) return;
    const timer = setTimeout(() => setShowFallback(true), HANDOFF_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <View className="flex-1">
      {showBackButton && (
        <View className="px-4 pt-2">
          <BackButton />
        </View>
      )}
      <View className="flex-1 items-center justify-center px-8 pb-20">
        <Text className={`text-center text-lg font-semibold ${tone}`}>{title}</Text>
        <Text className="mt-2 text-center text-[#ACACAC]">{body}</Text>
        {showFallback && onContinue && (
          <Button variant="brand" onPress={onContinue} className="mt-6 h-12 rounded-xl px-8">
            <Text className="font-semibold text-primary-foreground">Continue</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

export function KycNativeWaiting() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#94F27F" />
      <Text className="mt-4 text-center text-[#ACACAC]">
        Verification opened. Complete it and return here.
      </Text>
    </View>
  );
}
