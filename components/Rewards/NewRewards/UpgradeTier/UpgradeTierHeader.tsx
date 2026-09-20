import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';

import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

interface UpgradeTierHeaderProps {
  title: string;
  /** Where "back" lands when there is no history — a deep link into this flow. */
  fallbackHref?: string;
}

/**
 * Back on the left, title in the middle, dismiss on the right.
 *
 * The two are not the same action and the design gives them separate controls:
 * back steps to the previous screen of the flow, while ✕ leaves the flow
 * altogether and returns to Rewards. Collapsing them would strand a user on the
 * confirmation screen with only a way back to the step they had finished with.
 */
const UpgradeTierHeader = ({
  title,
  fallbackHref = path.REWARDS as string,
}: UpgradeTierHeaderProps) => (
  <View className="mb-6 h-[50px] flex-row items-center justify-between px-4">
    <BackButton variant="header" fallbackHref={fallbackHref} />

    <Text className="text-[20px] font-semibold leading-6 text-white">{title}</Text>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={() => router.replace(path.REWARDS)}
      className="h-[50px] w-[50px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80"
    >
      <X color="white" size={20} strokeWidth={2} />
    </Pressable>
  </View>
);

export default UpgradeTierHeader;
