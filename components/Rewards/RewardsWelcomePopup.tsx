import { View } from 'react-native';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

type RewardsWelcomeVariant = 'new' | 'existing';

interface RewardsWelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  /** 'new' for users with no legacy points, 'existing' for users whose old points carry over. */
  variant: RewardsWelcomeVariant;
  /** Disables the join button while the opt-in request is in flight. */
  isJoining?: boolean;
  /** Existing-user only: the user's old Solid Points total before conversion. */
  oldPoints?: number;
  /** Existing-user only: the Legacy Carryover Credit granted in the new program. */
  legacyCarryoverPoints?: number;
  /** Existing-user only: the tier the user starts in after carryover (Core or Prime). */
  startingTier?: RewardsTier;
}

const RewardsWelcomePopup = ({
  isOpen,
  onClose,
  onAgree,
  variant,
  isJoining = false,
  oldPoints = 0,
  legacyCarryoverPoints = 0,
  startingTier = RewardsTier.CORE,
}: RewardsWelcomePopupProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-[90vw] max-w-[480px] border-0 border-none bg-[#1C1C1E] p-0"
      >
        <View className="relative">
          <View className="relative h-64 w-full">
            <Image
              source={getAsset('images/reward-popup-background.png')}
              style={{ width: '100%', height: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
              contentFit="cover"
            />
            <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
              <Image
                source={getAsset('images/reward-star.png')}
                contentFit="contain"
                style={{ width: 450, height: 450 }}
              />
            </View>
          </View>

          <DialogCloseButton className="absolute left-4 top-4 z-10 bg-black/40" />

          <View className="px-6 pt-6">
            <Text className="mb-4 text-2xl font-semibold text-white">
              Welcome to the rewards program
            </Text>

            {variant === 'new' ? (
              <View className="gap-4">
                <Text className="text-base font-medium text-white/70">
                  Earn points when you save, spend, swap, and invite friends. Start in Core, then
                  build toward Prime and Ultra for better rewards and perks.
                </Text>
                <Text className="text-base font-medium text-white/70">
                  In clicking the button below you are agreeing to the Solid Rewards Terms and
                  understand rewards are subject to eligibility, caps, and program rules.
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                <Text className="text-base font-medium text-white/70">
                  {`Your old Solid Points are moving into Solid Rewards. We're converting your previous
                  points into a Legacy Carryover Credit so your progress counts in the new rewards
                  program.`}
                </Text>
                <View className="gap-1">
                  <Text className="text-base font-medium text-white/70">
                    Old points:{' '}
                    <Text className="font-semibold text-white">{formatNumber(oldPoints, 0, 0)}</Text>
                  </Text>
                  <Text className="text-base font-medium text-white/70">
                    Carryover credit:{' '}
                    <Text className="font-semibold text-white">
                      {formatNumber(legacyCarryoverPoints, 0, 0)}
                    </Text>
                  </Text>
                  <Text className="text-base font-medium text-white/70">
                    Starting tier:{' '}
                    <Text className="font-semibold text-white">
                      {getTierDisplayName(startingTier)}
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="flex-row items-center justify-start px-6 pb-6 pt-6">
            <Button
              onPress={onAgree}
              disabled={isJoining}
              variant="brand"
              className="h-10 rounded-[12px] px-6"
            >
              <Text className="font-bold text-black">{isJoining ? 'Joining...' : 'Agree & Join'}</Text>
            </Button>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default RewardsWelcomePopup;
