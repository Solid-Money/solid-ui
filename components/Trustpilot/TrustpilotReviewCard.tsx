import { Linking, Platform, Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { isTrustpilotConfigured, TRUSTPILOT_REVIEW_URL } from '@/constants/trustpilot';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface TrustpilotReviewCardProps {
  /** Context string for analytics, e.g. where in the app this card sits. */
  analyticsContext?: string;
  className?: string;
}

/**
 * "Enjoying Solid?" review link, styled to sit in the same stack as the settings rows.
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

  const handlePress = () => {
    track(TRACKING_EVENTS.TRUSTPILOT_REVIEW_LINK_OPENED, { context: analyticsContext });
    void Linking.openURL(TRUSTPILOT_REVIEW_URL);
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'flex-row items-center justify-between rounded-xl bg-[#1c1c1c] px-5 py-4 active:opacity-70',
        className,
      )}
      accessibilityRole="link"
      accessibilityLabel="Review Solid on Trustpilot"
    >
      <View className="flex-1 pr-4">
        <Text className="text-base font-bold text-white">Enjoying Solid?</Text>
        <Text className="mt-1 text-sm text-[#ACACAC]">
          Tell others what you think — it takes a minute and it genuinely helps.
        </Text>
      </View>
      <ChevronRight size={20} color="white" strokeWidth={1.5} />
    </Pressable>
  );
}
