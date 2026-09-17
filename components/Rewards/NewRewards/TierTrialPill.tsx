import { useState } from 'react';
import { Pressable, TextStyle, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { TierTrial } from '@/lib/types';

import { trialRemainingLabel } from './tierTrialCopy';

const PILL_STYLE: TextStyle = {
  fontFamily: 'MonaSans_500Medium',
  fontSize: 13,
  lineHeight: 16,
};
const TITLE_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 22,
  lineHeight: 26,
};
const EXPIRY_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 15,
  lineHeight: 20,
};
const BODY_STYLE: TextStyle = {
  fontFamily: 'MonaSans_400Regular',
  fontSize: 15,
  lineHeight: 20,
};
const BUTTON_LABEL_STYLE: TextStyle = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 16,
  lineHeight: 20,
};

/** "October 6, 2026 at 14:00", as the detail popup dates it. */
const formatExpiry = (expiresAt: string | null): string | null => {
  if (!expiresAt) return null;

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${day} at ${time}`;
};

/**
 * The trial countdown under the tier name on the rewards screen, and the
 * explanation behind it (Figma 25481:2752).
 *
 * The pill answers "how long have I got"; tapping it answers "and then what",
 * which is the question a temporary tier actually raises. Both come from the
 * same trial, so the countdown and the date it counts down to cannot disagree.
 *
 * Renders nothing without a running trial: an ordinary tier needs no countdown.
 */
const TierTrialPill = ({ trial }: { trial?: TierTrial | null }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!trial || trial.status !== 'active') return null;

  const tierName = getTierDisplayName(trial.tier);
  const expiry = formatExpiry(trial.expiresAt);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tierName} trial, ${trialRemainingLabel(trial)}. Tap for details.`}
        onPress={() => setIsOpen(true)}
        hitSlop={8}
        className="self-center rounded-full bg-brand/15 px-3 py-1 transition-opacity active:opacity-70"
      >
        <Text className="text-brand" style={PILL_STYLE}>
          {tierName} trial · {trialRemainingLabel(trial)}
        </Text>
      </Pressable>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[92vw] max-w-[360px] gap-0 rounded-[30px] border-0 border-none bg-[#161616] p-6"
        >
          <View className="w-full">
            <Text className="text-white" style={TITLE_STYLE}>
              Your {tierName} trial
            </Text>

            {!!expiry && (
              <Text className="mt-2 text-brand" style={EXPIRY_STYLE}>
                Ends {expiry}
              </Text>
            )}

            <Text className="mt-4 text-white/70" style={BODY_STYLE}>
              Enjoy {tierName} until your trial ends. Then your tier will be based on your points
              and FUSE Savings balance.
            </Text>

            <Button
              variant="brand"
              onPress={() => setIsOpen(false)}
              className="mt-6 h-[50px] w-full rounded-full px-0 py-0"
            >
              <Text className="text-black" style={BUTTON_LABEL_STYLE}>
                Got it
              </Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TierTrialPill;
