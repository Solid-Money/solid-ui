import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Image, ImageSourcePropType, View } from 'react-native';

import DepositComingSoon from '@/components/DepositOption/DepositComingSoon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type DepositNetworkProps = {
  name: string;
  description: string;
  icon: ImageSourcePropType;
  isComingSoon?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
};

const DepositNetwork = ({
  name,
  description,
  icon,
  onPress,
  isComingSoon,
  disabled,
  isLoading,
}: DepositNetworkProps) => {
  return (
    <Button
      className="flex-row items-center justify-between rounded-2xl bg-primary/10 p-6 disabled:opacity-100 web:hover:bg-accent disabled:web:hover:opacity-100"
      style={{ height: 88 }}
      onPress={onPress}
      disabled={isComingSoon || disabled}
    >
      <View className="flex-row items-center gap-x-2">
        <Image source={icon} style={{ width: 34, height: 34 }} />
        <View>
          <Text className="text-lg font-semibold leading-5 text-primary">{name}</Text>
          <Text className="leading-4 text-muted-foreground">{description}</Text>
        </View>
      </View>
      {isComingSoon ? (
        <DepositComingSoon />
      ) : isLoading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <ChevronRight color="white" size={20} />
      )}
    </Button>
  );
};

export default DepositNetwork;
