import SavingCountUp from '@/components/SavingCountUp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDimension } from '@/hooks/useDimension';
import { useDepositStore } from '@/store/useDepositStore';
import { Plus } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface DashboardHeaderProps {
  balance: number;
  totalAPY: number;
  firstDepositTimestamp: number;
  originalDepositAmount: number;
}

export function DashboardHeader({
  balance,
  totalAPY,
  firstDepositTimestamp,
  originalDepositAmount,
}: DashboardHeaderProps) {
  const { isScreenMedium } = useDimension();

  const { setModal } = useDepositStore();

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="flex-row items-center">
          <Text className="text-5xl md:text-8xl text-foreground font-semibold">$</Text>
          <SavingCountUp
            balance={balance}
            apy={totalAPY}
            lastTimestamp={firstDepositTimestamp}
            principal={originalDepositAmount}
            classNames={{
              wrapper: 'text-foreground',
              decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
            }}
            styles={{
              wholeText: {
                fontSize: isScreenMedium ? 96 : 48,
                fontWeight: isScreenMedium ? 'medium' : 'semibold',
                color: '#ffffff',
                marginRight: -2,
              },
              decimalText: {
                fontSize: isScreenMedium ? 40 : 24,
                fontWeight: isScreenMedium ? 'medium' : 'semibold',
                color: '#ffffff',
              },
            }}
          />
        </View>
      </View>
      <Button
        variant="brand"
        className="h-12 pr-6 rounded-xl"
        onPress={() => setModal(DEPOSIT_MODAL.OPEN_OPTIONS)}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="black" />
          <Text className="text-primary-foreground font-bold">Add funds</Text>
        </View>
      </Button>
    </View>
  );
}
