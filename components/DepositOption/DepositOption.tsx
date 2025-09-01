import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import DepositComingSoon from './DepositComingSoon';

type DepositOptionProps = {
  text: string;
  icon: React.ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
};

const DepositOption = ({ text, icon, onPress, isLoading, isComingSoon }: DepositOptionProps) => {
  const isDisabled = isComingSoon || isLoading;

  return (
    <Button
      className="flex-row items-center justify-between bg-primary/10 rounded-2xl p-6 disabled:opacity-100 disabled:web:hover:opacity-100"
      style={{ height: 88 }}
      onPress={onPress}
      disabled={isDisabled}
    >
      <View className="flex-row items-center gap-x-2">
        {icon}
        <Text className="text-primary text-lg font-semibold">{text}</Text>
      </View>
      {isComingSoon ? (
        <DepositComingSoon />
      ) : isLoading ? (
        <ActivityIndicator color="white" size={20} />
      ) : (
        <ChevronRight color="white" size={20} />
      )}
    </Button>
  );
};

export default DepositOption;
