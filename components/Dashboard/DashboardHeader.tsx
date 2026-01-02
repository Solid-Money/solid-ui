import React from 'react';
import { View } from 'react-native';

import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import DashboardSavings from '@/components/Dashboard/DashboardSavings';
import { SavingMode } from '@/lib/types';

interface DashboardHeaderProps {
  balance: number;
  totalAPY?: number;
  firstDepositTimestamp?: number;
  mode?: SavingMode;
  tooltipText?: string;
}

export default function DashboardHeader({
  balance,
  totalAPY,
  firstDepositTimestamp,
  mode,
  tooltipText,
}: DashboardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <DashboardSavings
          balance={balance}
          totalAPY={totalAPY}
          firstDepositTimestamp={firstDepositTimestamp}
          mode={mode}
          tooltipText={tooltipText}
        />
      </View>
      <DashboardHeaderButtons />
    </View>
  );
}
