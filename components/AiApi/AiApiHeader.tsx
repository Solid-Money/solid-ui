import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Info } from 'lucide-react-native';

import { BackButton } from '@/components/ui/back-button';
import { CIRCULAR_CONTROL_CLASS_NAME } from '@/components/ui/circular-control';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { cn } from '@/lib/utils';

import { AI_API_ICON_STROKE } from './AiApiPrimitives';

/** The round control on the header's right, matching the back button beside it. */
export const AiApiHeaderButton = ({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={onPress}
    className={cn(
      'items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted',
      CIRCULAR_CONTROL_CLASS_NAME,
    )}
  >
    {children}
  </Pressable>
);

export const AiApiInfoButton = ({ onPress }: { onPress: () => void }) => (
  <AiApiHeaderButton onPress={onPress} accessibilityLabel="How it works">
    <Info size={20} color="white" strokeWidth={AI_API_ICON_STROKE} />
  </AiApiHeaderButton>
);

/**
 * Back, the screen's name centred, and an optional action — the header the
 * Insights screen uses, so these screens sit in the app the same way.
 */
const AiApiHeader = ({
  title,
  onBack,
  backIcon,
  backLabel,
  right,
}: {
  title: string;
  /** Replaces going back, e.g. to leave "How it works" for the dashboard. */
  onBack?: () => void;
  backIcon?: ReactNode;
  backLabel?: string;
  right?: ReactNode;
}) => (
  <View className="relative min-h-[50px] flex-row items-center justify-center px-4">
    <View className="absolute left-4">
      <BackButton
        fallbackHref={path.REWARDS as string}
        onPress={onBack}
        icon={backIcon}
        accessibilityLabel={backLabel}
      />
    </View>
    <Text className="text-lg font-semibold text-white">{title}</Text>
    {right ? <View className="absolute right-4">{right}</View> : null}
  </View>
);

export default AiApiHeader;
