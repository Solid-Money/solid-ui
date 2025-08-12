import { ChevronRight } from 'lucide-react-native';
import { Image, ImageSourcePropType, View } from 'react-native';

import DepositComingSoon from '@/components/DepositOption/DepositComingSoon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type DepositNetworkProps = {
  name: string;
  description: string;
  icon: ImageSourcePropType;
  isComingSoon?: boolean;
  onPress: () => void;
};

const DepositNetwork = ({
  name,
  description,
  icon,
  onPress,
  isComingSoon,
}: DepositNetworkProps) => {
  return (
    <Button
      className="flex-row items-center justify-between bg-primary/10 rounded-2xl h-20 p-6 disabled:opacity-100 disabled:web:hover:opacity-100"
      onPress={onPress}
      disabled={isComingSoon}
    >
      <View className="flex-row items-center gap-x-2">
        <Image source={icon} style={{ width: 34, height: 34 }} />
        <View>
          <Text className="text-primary text-lg leading-5 font-semibold">{name}</Text>
          <Text className="text-muted-foreground leading-4">{description}</Text>
        </View>
      </View>
      {isComingSoon ? <DepositComingSoon /> : <ChevronRight color="white" size={20} />}
    </Button>
  );
};

export default DepositNetwork;
