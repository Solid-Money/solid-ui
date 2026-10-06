import { useEffect } from 'react';
import { View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

import { ONRAMPER_WIDGET_HEIGHT } from './OnramperWidgetStates';

/**
 * What a Sumsub share token lets Onramper import. Onramper passes it on to the
 * provider the user picks, which is why the copy names both.
 */
const SHARED_ITEMS = [
  'Your legal name, date of birth and email',
  'The ID documents from your Solid verification',
  'The result of your completed identity check',
];

interface OnramperKycConsentProps {
  /** `true` to share, `false` to carry on without — both open the widget. */
  onDecide: (shareKyc: boolean) => void;
}

/**
 * Asks before a verified user's identity goes to Onramper. Declining is not a
 * dead end: the widget opens either way, and the provider verifies the user
 * itself, as it always did.
 *
 * Asked on every open rather than remembered. Each purchase mints its own share
 * token, and there is nowhere in the app to take a remembered "yes" back.
 */
export const OnramperKycConsent = ({ onDecide }: OnramperKycConsentProps) => {
  useEffect(() => {
    track(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_VIEWED);
  }, []);

  const decide = (shareKyc: boolean) => {
    track(
      shareKyc
        ? TRACKING_EVENTS.ONRAMPER_KYC_SHARE_ACCEPTED
        : TRACKING_EVENTS.ONRAMPER_KYC_SHARE_DECLINED,
    );
    onDecide(shareKyc);
  };

  return (
    <View className="w-full gap-6" style={{ minHeight: ONRAMPER_WIDGET_HEIGHT }}>
      <View className="items-center gap-4 pt-2">
        <View className="items-center justify-center rounded-full bg-card p-5">
          <ShieldCheck size={40} color="#94F27F" />
        </View>
        <View className="items-center gap-2 px-4">
          <Text className="text-center text-2xl font-bold text-primary">
            Skip ID checks at checkout
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            You&apos;re already verified with Solid. Share that verification with Onramper and the
            payment provider you choose, so you don&apos;t have to verify again for this purchase.
          </Text>
        </View>
      </View>

      <View className="gap-4 rounded-2xl bg-card p-5">
        <Text className="text-sm font-semibold text-muted-foreground">What we share</Text>
        {SHARED_ITEMS.map(item => (
          <View key={item} className="flex-row items-start gap-3">
            <Check size={16} color="#94F27F" style={{ marginTop: 2 }} />
            <Text className="flex-1 text-base leading-5 text-primary">{item}</Text>
          </View>
        ))}
      </View>

      <View className="mt-auto gap-3">
        <Button className="h-14 rounded-2xl" variant="brand" onPress={() => decide(true)}>
          <Text className="text-base font-bold text-primary-foreground">Share &amp; continue</Text>
        </Button>
        <Button className="h-12 rounded-2xl" variant="ghost" onPress={() => decide(false)}>
          <Text className="text-base font-semibold text-muted-foreground">
            Continue without sharing
          </Text>
        </Button>
      </View>
    </View>
  );
};

export default OnramperKycConsent;
