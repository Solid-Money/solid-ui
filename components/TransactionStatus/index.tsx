import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Address } from 'viem';

import Checkmark from '@/assets/images/checkmark';
import NeedHelp from '@/components/NeedHelp';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TokenIcon } from '@/lib/types';
import { eclipseAddress, formatNumber } from '@/lib/utils';

type TransactionStatusProps = {
  amount: number;
  address?: Address;
  onPress: () => void;
  title?: string;
  description?: string;
  status?: string;
  icon: TokenIcon;
  token?: string;
  buttonText?: string;
};

const TransactionStatus = ({
  amount,
  address,
  onPress,
  title = 'Withdraw started',
  description = "This may take up to 24H. We'll keep processing this in the background. You can safely leave this page.",
  status = 'Initiated',
  icon,
  token = 'USDC',
  buttonText = 'View recent activity',
}: TransactionStatusProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = () => {
    setIsLoading(true);
    onPress();
  };

  return (
    <View className="gap-8">
      <View className="items-center">
        <Checkmark />
      </View>

      <View className="gap-2">
        <Text className="text-center text-2xl font-semibold">{title}</Text>
        <Text className="text-center leading-5 text-muted-foreground">{description}</Text>
      </View>

      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-2 rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <RenderTokenIcon tokenIcon={icon} size={40} />
            <View>
              <View className="flex-row gap-1">
                <Text className="font-medium">{formatNumber(amount)}</Text>
                <Text className="text-muted-foreground">{token}</Text>
              </View>
              {address && (
                <View className="flex-row gap-1">
                  <Text className="text-muted-foreground">to</Text>
                  <Text className="font-medium">{eclipseAddress(address)}</Text>
                </View>
              )}
            </View>
          </View>
          <Text className="font-medium text-muted-foreground">{status}</Text>
        </View>
        <Button
          variant="brand"
          className="h-12 rounded-2xl"
          onPress={handlePress}
          disabled={isLoading}
        >
          <Text className="text-lg font-semibold">{buttonText}</Text>
          {isLoading && <ActivityIndicator color="white" />}
        </Button>
      </View>

      <NeedHelp />
    </View>
  );
};

export default TransactionStatus;
