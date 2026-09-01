import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import MerchantBadge from '@/components/Card/ThreeDs/MerchantBadge';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { describeThreeDsError, THREE_DS_CANCELLED, useWirexThreeDs } from '@/hooks/useWirexThreeDs';
import { CardProvider, WirexThreeDsDecisionOutcome, WirexThreeDsRequest } from '@/lib/types';
import { formatCardAmount } from '@/lib/utils/cardHelpers';

/** How often to re-read the list while this screen is open. */
const POLL_MS = 15_000;

/**
 * Approve or decline one 3D Secure challenge.
 *
 * Where a 3DS push lands, and where the pending list sends the user. The merchant
 * is holding the transaction until this screen answers, which shapes it
 * throughout:
 *
 *  - It renders from the push payload first and swaps in the authoritative
 *    pending record when it loads, so there is no spinner between the tap and the
 *    decision.
 *  - Approving raises a passkey prompt (the backend verifies that signature
 *    against the card's own wallet before it lets the payment through), while
 *    declining does not — someone stopping a payment they don't recognise must
 *    not be blocked by a biometric check that fails.
 *  - A challenge that is no longer live is stated plainly rather than shown as an
 *    error: timing out at the terminal is the ordinary way one of these ends.
 */
export default function ThreeDsRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    transactionId: string;
    amount?: string;
    currency?: string;
    merchantName?: string;
    cardLast4?: string;
  }>();
  const transactionId = params.transactionId;

  const { requests, isLoading, decide, isSupported } = useWirexThreeDs({ pollMs: POLL_MS });
  // Only a real outcome is kept: a cancelled passkey prompt leaves the screen
  // alone rather than becoming a result to render.
  const [result, setResult] = useState<WirexThreeDsDecisionOutcome | null>(null);
  const [pendingVerdict, setPendingVerdict] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The authoritative record, once the list arrives. Everything the screen does
  // is gated on this rather than on the push payload — a push can be replayed
  // from the notification tray long after the challenge is over.
  const live = requests.find(request => request.transactionId === transactionId);
  const preview = buildPreview(params);
  const request = live ?? preview;
  const isGone = isSupported && !isLoading && !live;

  const handleDecide = async (verdict: 'approve' | 'decline') => {
    setError(null);
    setPendingVerdict(verdict);
    try {
      const outcome = await decide(transactionId, verdict);
      // A dismissed passkey prompt is the user changing their mind, not a
      // failure: leave the screen exactly as it was so they can decide again.
      if (outcome !== THREE_DS_CANCELLED) setResult(outcome);
    } catch (decideError) {
      setError(await describeThreeDsError(decideError));
    } finally {
      setPendingVerdict(null);
    }
  };

  const done = () => (router.canGoBack() ? router.back() : router.replace(path.CARD_3DS));

  return (
    <PageLayout desktopOnly isLoading={isLoading && !request}>
      <View className="mx-auto w-full max-w-[600px] flex-1 px-4 pt-8">
        <View className="mb-10 flex-row items-center justify-between px-4">
          <BackButton fallbackHref={path.CARD_DETAILS} />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Confirm payment
          </Text>
          {/* Balances the back button so the title stays centred. */}
          <View className="h-[50px] w-[50px]" />
        </View>

        {request ? <RequestSummary request={request} /> : null}

        {result ? (
          <Outcome outcome={result} onDone={done} />
        ) : isGone ? (
          <Notice
            title="No longer waiting"
            body="This payment timed out or has already been answered. If you still need to pay, try again at the terminal."
            onDone={done}
          />
        ) : (
          <View className="mt-10 gap-3">
            {error ? (
              <Text className="mb-1 text-center text-sm text-destructive">{error}</Text>
            ) : null}
            <Button
              variant="brand"
              disabled={pendingVerdict !== null}
              onPress={() => handleDecide('approve')}
            >
              {pendingVerdict === 'approve' ? (
                <ActivityIndicator color="black" size="small" />
              ) : (
                <Text>Approve payment</Text>
              )}
            </Button>
            <Button
              variant="secondary"
              className="native:h-[50px] h-[50px] rounded-[30px]"
              disabled={pendingVerdict !== null}
              onPress={() => handleDecide('decline')}
            >
              {pendingVerdict === 'decline' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-base font-semibold">Decline</Text>
              )}
            </Button>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Approving asks for your passkey. Decline if you don&apos;t recognise this payment.
            </Text>
          </View>
        )}
      </View>
    </PageLayout>
  );
}

/**
 * What the push already told us, used until the pending list confirms it. Only
 * built when the merchant is known — an amount with nothing attached to it says
 * less than showing nothing at all.
 */
function buildPreview(params: {
  transactionId: string;
  amount?: string;
  currency?: string;
  merchantName?: string;
  cardLast4?: string;
}): WirexThreeDsRequest | undefined {
  if (!params.merchantName) return undefined;
  return {
    transactionId: params.transactionId,
    cardId: '',
    cardLast4: params.cardLast4 ?? '',
    amount: params.amount ?? '',
    currency: params.currency ?? '',
    merchantName: params.merchantName,
  };
}

const RequestSummary = ({ request }: { request: WirexThreeDsRequest }) => (
  <View className="items-center">
    <MerchantBadge name={request.merchantName} size={56} />
    {/* A push can reach us without an amount; "$NaN" above a payment decision is
        worse than no figure at all, so the merchant carries the screen instead. */}
    {Number.isFinite(Number(request.amount)) && request.amount ? (
      <Text className="mt-5 text-center text-4xl font-semibold text-white">
        {formatCardAmount(request.amount, CardProvider.WIREX, request.currency)}
      </Text>
    ) : null}
    <Text className="mt-2 text-center text-base text-muted-foreground">{request.merchantName}</Text>
    {request.cardLast4 ? (
      <Text className="mt-1 text-center text-sm text-muted-foreground">
        Card •••• {request.cardLast4}
      </Text>
    ) : null}
  </View>
);

const OUTCOME_COPY: Record<WirexThreeDsDecisionOutcome, { title: string; body: string }> = {
  [WirexThreeDsDecisionOutcome.APPROVED]: {
    title: 'Payment approved',
    body: "It's going through now and will appear in your activity shortly.",
  },
  [WirexThreeDsDecisionOutcome.DECLINED]: {
    title: 'Payment declined',
    body: 'The merchant has been told to stop it. No money left your account.',
  },
  [WirexThreeDsDecisionOutcome.EXPIRED]: {
    title: 'No longer waiting',
    body: 'This payment timed out or had already been answered. If you still need to pay, try again at the terminal.',
  },
};

const Outcome = ({
  outcome,
  onDone,
}: {
  outcome: WirexThreeDsDecisionOutcome;
  onDone: () => void;
}) => {
  const copy = OUTCOME_COPY[outcome];
  return <Notice title={copy.title} body={copy.body} onDone={onDone} />;
};

const Notice = ({ title, body, onDone }: { title: string; body: string; onDone: () => void }) => (
  <View className="mt-10 items-center gap-3">
    <Text className="text-center text-lg font-semibold text-white">{title}</Text>
    <Text className="mb-4 text-center text-sm text-muted-foreground">{body}</Text>
    <Button variant="brand" className="w-full" onPress={onDone}>
      <Text>Done</Text>
    </Button>
  </View>
);
