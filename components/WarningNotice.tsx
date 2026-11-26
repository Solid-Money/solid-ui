import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

interface WarningNoticeProps {
  title: string;
  body: string;
  titleClassName?: string;
  bodyClassName?: string;
}

/**
 * The amber "check this before you go on" notice the send form shows for a
 * contract recipient: informational, never blocking. Shared so every flow that
 * needs one draws the same box rather than its own.
 */
const WarningNotice = ({ title, body, titleClassName, bodyClassName }: WarningNoticeProps) => (
  <LinearGradient
    colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    className="overflow-hidden rounded-2xl border border-warning/15"
  >
    <View className="flex-row gap-2 gap-3 px-5 py-4">
      <Image
        source={getAsset('images/exclamation-warning.png')}
        style={{ width: 22, height: 22 }}
        contentFit="contain"
      />
      <View className="flex-1">
        <Text className={cn('text-base font-bold text-warning', titleClassName)}>{title}</Text>
        <Text className={cn('text-sm font-medium leading-5 text-warning', bodyClassName)}>
          {body}
        </Text>
      </View>
    </View>
  </LinearGradient>
);

export default WarningNotice;
