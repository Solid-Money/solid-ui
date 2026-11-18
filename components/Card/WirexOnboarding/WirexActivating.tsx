import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { CardStatusPanel } from '@/components/Card/CardStatusPage';
import { TickIcon } from '@/components/Card/MainCurrency/icons';
import {
  CardWaitingHero,
  WirexOnboardingLayout,
} from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

export type ActivationItemState = 'done' | 'active' | 'pending';

export interface ActivationItem {
  label: string;
  /** Shown instead of the label once the item is done ("Card turned on"). */
  doneLabel?: string;
  state: ActivationItemState;
}

const ItemIcon = ({ state }: { state: ActivationItemState }) => {
  if (state === 'done') return <TickIcon />;
  if (state === 'active') {
    return (
      <View className="h-5 w-5 items-center justify-center">
        <ActivityIndicator size="small" color="#94F27F" />
      </View>
    );
  }
  return <View className="h-5 w-5 rounded-full border border-white/20" />;
};

/**
 * "Activating your card" (Figma 6 · Activating): what the Activate tap is doing, one line per
 * piece of it — the card approval, the euro approval when euro was picked, and the card itself —
 * so the wait after the passkey reads as progress rather than a frozen button.
 */
export function WirexActivating({ items }: { items: ActivationItem[] }) {
  useEffect(() => {
    track(TRACKING_EVENTS.CARD_ONBOARDING_STEP_VIEWED, { step: 'activating' });
  }, []);

  return (
    <WirexOnboardingLayout step={3} hideBack>
      <CardStatusPanel title="Activating your card" image={<CardWaitingHero />}>
        <View className="mt-3 items-center">
          <View className="gap-3.5">
            {items.map(item => (
              <View key={item.label} className="flex-row items-center gap-2.5">
                <ItemIcon state={item.state} />
                <Text
                  className={`text-[15px] ${
                    item.state === 'done' ? 'text-white/90' : 'text-white/60'
                  }`}
                >
                  {item.state === 'done' ? (item.doneLabel ?? item.label) : item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </CardStatusPanel>
    </WirexOnboardingLayout>
  );
}

export default WirexActivating;
