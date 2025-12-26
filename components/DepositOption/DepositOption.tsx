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
      className="flex-row items-center justify-between bg-card web:hover:bg-card-hover rounded-2xl px-5 native:py-10 web:py-6"
      onPress={onPress}
      disabled={isDisabled}
    >
      <View className="flex-row gap-x-4 flex-1 items-start">
        <View className="mt-0.5">{icon}</View>
        <View className="flex-col gap-y-1 flex-1">
          <Text className="text-primary text-lg font-semibold leading-6">{text}</Text>
          {subtitle && (
            <Text
              className="text-muted-foreground text-sm leading-5"
              style={Platform.OS === 'web' ? ({ whiteSpace: 'pre-line' } as any) : undefined}
            >
              {subtitle}
            </Text>
          )}
          {bannerText && (
            <View className="bg-[#94F27F]/20 self-start px-3 py-1 rounded-2xl mt-1">
              <Text className="text-[#94F27F] font-bold text-base">{bannerText}</Text>
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
