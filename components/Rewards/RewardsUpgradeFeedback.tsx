import { useEffect } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { useRewardsUserData } from '@/hooks/useRewards';
import {
  getConfirmedUpgradeBenefits,
  REWARDS_RECONCILIATION_INTERVAL_MS,
} from '@/lib/rewardsUpgrade';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

export default function RewardsUpgradeFeedback() {
  const { height } = useWindowDimensions();
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const state = useRewardsUpgradeStore();
  const active = userId === state.userId;
  useRewardsUserData({
    refetchInterval: active && state.pendingUntil ? REWARDS_RECONCILIATION_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!active || !state.pendingUntil) return;
    const timer = setTimeout(state.finishWaiting, Math.max(0, state.pendingUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [active, state.pendingUntil, state.finishWaiting]);

  const success = active ? state.success : undefined;
  return (
    <Dialog
      open={!!success}
      onOpenChange={open => {
        if (!open) state.dismiss();
      }}
    >
      <DialogContent className="w-[90%] max-w-md rounded-3xl bg-[#1C1C1C] p-6">
        <DialogTitle className="text-2xl text-white">
          {success ? `${getTierDisplayName(success.currentTier)} unlocked` : 'Tier upgraded'}
        </DialogTitle>
        <ScrollView style={{ maxHeight: height * 0.6 }}>
          <Text className="text-white/70">
            Your new tier is confirmed. Your benefits now include:
          </Text>
          <View className="gap-3 py-3">
            {success &&
              getConfirmedUpgradeBenefits(success).map(benefit => (
                <Text key={benefit} className="text-base text-white">
                  {benefit}
                </Text>
              ))}
          </View>
          {success?.fuseSkipLine?.enabled &&
            success.fuseSkipLine.unlockedTier === success.currentTier && (
              <Text className="text-sm text-white/70">
                Keep the required FUSE in Savings to retain this tier through FUSE eligibility.
              </Text>
            )}
        </ScrollView>
        <Button variant="brand" onPress={state.dismiss}>
          <Text>Got it</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
