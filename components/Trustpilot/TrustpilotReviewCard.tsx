import { Platform, View } from 'react-native';

import TrustpilotWidget from '@/components/Trustpilot/TrustpilotWidget';
import { Text } from '@/components/ui/text';
import { isTrustpilotConfigured } from '@/constants/trustpilot';
import { cn } from '@/lib/utils';

interface TrustpilotReviewCardProps {
  /** Context string for analytics, e.g. where in the app this card sits. */
  analyticsContext?: string;
  className?: string;
}

/**
 * "Enjoying Solid?" card wrapping the Trustpilot Review Collector widget, styled to sit
 * in the same stack as the settings rows.
 *
 * Settings is the placement on purpose. The widget is standing UI rather than a prompt —
 * it cannot be timed to a happy moment the way the native review sheet is — so putting
 * it anywhere a user passes through on their way to something else would be noise on
 * every visit. Here it is found by someone who came looking for account actions, and
 * costs nothing to everyone else.
 *
 * Web only, and only once Trustpilot is configured; renders nothing otherwise. The
 * native apps ask for a rating through the OS review sheet instead, which App Store
 * guidelines require in-app rating prompts to use.
 */
export default function TrustpilotReviewCard({
  analyticsContext = 'settings',
  className,
}: TrustpilotReviewCardProps) {
  if (Platform.OS !== 'web' || !isTrustpilotConfigured()) return null;

  return (
    <View className={cn('overflow-hidden rounded-xl bg-[#1c1c1c] px-5 py-4', className)}>
      <Text className="text-base font-bold text-white">Enjoying Solid?</Text>
      <Text className="mt-1 text-sm text-[#ACACAC]">
        Tell others what you think — it takes a minute and it genuinely helps.
      </Text>
      <TrustpilotWidget analyticsContext={analyticsContext} className="mt-3" />
    </View>
  );
}
