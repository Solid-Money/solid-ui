import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import DepositComingSoon from './DepositComingSoon';

type DepositOptionProps = {
  text: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
  bannerText?: string;
};

const DepositOption = ({
  text,
  subtitle,
  icon,
  onPress,
  isLoading,
  isComingSoon,
  bannerText,
}: DepositOptionProps) => {
  const isDisabled = isComingSoon || isLoading;

  return (
    <Pressable
      className="native:py-10 flex-row items-center justify-between rounded-2xl bg-card px-5 web:py-6 web:hover:bg-card-hover"
      onPress={onPress}
      disabled={isDisabled}
    >
      <View className="flex-1 flex-row items-start gap-x-4">
        <View className="mt-0.5">{icon}</View>
        <View className="flex-1 flex-col gap-y-1">
          <Text className="text-lg font-semibold leading-6 text-primary">{text}</Text>
          {subtitle && (
            <Text
              className="text-sm leading-5 text-muted-foreground"
              style={Platform.OS === 'web' ? ({ whiteSpace: 'pre-line' } as any) : undefined}
            >
              {subtitle}
            </Text>
          )}
          {bannerText && (
            <View className="mt-1 self-start rounded-2xl bg-[#94F27F]/20 px-3 py-1">
              <Text className="text-base font-bold text-[#94F27F]">{bannerText}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="ml-3 self-center">
        {isComingSoon ? (
          <DepositComingSoon />
        ) : isLoading ? (
          <ActivityIndicator color="white" size={20} />
        ) : (
          <ChevronRight color="white" size={20} />
        )}
      </View>
    </Pressable>
  );
};

export default DepositOption;
