import React from 'react';
import { View } from 'react-native';

import { SavingMode } from '@/lib/types';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import DashboardSavings from '@/components/Dashboard/DashboardSavings';

interface DashboardHeaderProps {
  balance: number;
  totalAPY?: number;
  firstDepositTimestamp?: number;
  originalDepositAmount?: number;
  mode?: SavingMode;
  hasTokens: boolean;
  tooltipText?: string;
}

export default function DashboardHeader({
  balance,
  totalAPY,
  firstDepositTimestamp,
  originalDepositAmount,
  mode,
  hasTokens,
  tooltipText,
}: DashboardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <DashboardSavings
          balance={balance}
          totalAPY={totalAPY}
          firstDepositTimestamp={firstDepositTimestamp}
          originalDepositAmount={originalDepositAmount}
          mode={mode}
          tooltipText={tooltipText}
        />
      </View>
      <DashboardHeaderButtons hasTokens={hasTokens} />
    </View>
  );
}
