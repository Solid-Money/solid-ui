import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogCloseButton, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/constants/rewards';
import { type AssetPath, getAsset } from '@/lib/assets';
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

const HEADER_HEIGHT = 205;
const POPUP_GLOW_SIZE = 344;
const POPUP_STAR_SIZE = 281;
const POPUP_TEXTURE_ASSET: AssetPath = 'images/rewards-welcome-texture.png';
const POPUP_GLOW_ASSET: AssetPath = 'images/rewards-tiers/glow.svg';
const HEADER_GRADIENT = ['rgba(233, 233, 233, 0.15)', 'rgba(153, 153, 153, 0.05)'] as const;

const TITLE_STYLE = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 22,
  lineHeight: 22,
} as const;

const BODY_STYLE = {
  fontFamily: 'MonaSans_500Medium',
  fontSize: 16,
  lineHeight: 21,
} as const;

const BUTTON_LABEL_STYLE = {
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 16,
  lineHeight: 20,
} as const;

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
        className="w-[92vw] max-w-[387px] gap-0 border-0 border-none bg-transparent p-0"
      >
        <View className="relative w-full">
          <View className="w-full overflow-hidden rounded-[30px] bg-[#101010]">
            <View className="relative w-full overflow-hidden" style={{ height: HEADER_HEIGHT }}>
              <LinearGradient colors={HEADER_GRADIENT} style={StyleSheet.absoluteFillObject} />
              <Image
                source={getAsset(POPUP_TEXTURE_ASSET)}
                contentFit="cover"
                style={styles.headerTexture}
              />
            </View>

            <View className="min-h-[414px] px-[34px] pb-[31px] pt-[42px]">
              <Text className="text-white" style={TITLE_STYLE}>
                Welcome to the rewards program
              </Text>

              {variant === 'new' ? (
                <View className="mt-[17px] gap-6">
                  <Text className="text-white/70" style={BODY_STYLE}>
                    Earn points when you save, spend, swap, and invite friends. Start in Core, then
                    build toward Prime and Ultra for better rewards and perks.
                  </Text>
                  <Text className="text-white/70" style={BODY_STYLE}>
                    In clicking the button below you are agreeing to the Solid Rewards Terms and
                    understand rewards are subject to eligibility, caps, and program rules.
                  </Text>
                </View>
              ) : (
                <View className="mt-[17px] gap-6">
                  <Text className="text-white/70" style={BODY_STYLE}>
                    {
                      "Your old Solid Points are moving into Solid Rewards. We're converting your previous points into a Legacy Carryover Credit so your progress counts in the new rewards program."
                    }
                  </Text>
                  <View className="gap-1">
                    <Text className="text-white/70" style={BODY_STYLE}>
                      Old points:{' '}
                      <Text className="font-semibold text-white">
                        {formatNumber(oldPoints, 0, 0)}
                      </Text>
                    </Text>
                    <Text className="text-white/70" style={BODY_STYLE}>
                      Carryover credit:{' '}
                      <Text className="font-semibold text-white">
                        {formatNumber(legacyCarryoverPoints, 0, 0)}
                      </Text>
                    </Text>
                    <Text className="text-white/70" style={BODY_STYLE}>
                      Starting tier:{' '}
                      <Text className="font-semibold text-white">
                        {getTierDisplayName(startingTier)}
                      </Text>
                    </Text>
                  </View>
                </View>
              )}

              <Button
                onPress={onAgree}
                disabled={isJoining}
                variant="brand"
                className="mt-9 h-[50px] w-[170px] rounded-full px-0 py-0"
              >
                <Text className="text-black" style={BUTTON_LABEL_STYLE}>
                  {isJoining ? 'Joining...' : 'Agree & Join'}
                </Text>
              </Button>
            </View>
          </View>

          <View
            className="absolute left-1/2 top-[-60px] z-10"
            style={{ marginLeft: -POPUP_GLOW_SIZE / 2 }}
            pointerEvents="none"
          >
            <Image
              source={getAsset(POPUP_GLOW_ASSET)}
              contentFit="contain"
              style={{ width: POPUP_GLOW_SIZE, height: POPUP_GLOW_SIZE, opacity: 0.25 }}
            />
          </View>

          <View
            className="absolute left-1/2 top-[-35px] z-10"
            style={{ marginLeft: -POPUP_STAR_SIZE / 2 }}
            pointerEvents="none"
          >
            <TierStar tier={RewardsTier.CORE} size={POPUP_STAR_SIZE} />
          </View>

          <DialogCloseButton className="absolute right-[15px] top-[15px] z-20 bg-[#242424]" />
        </View>
      </DialogContent>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  headerTexture: {
    height: 565,
    left: '50%',
    opacity: 0.56,
    position: 'absolute',
    top: -86,
    transform: [{ translateX: -424 }],
    width: 848,
    mixBlendMode: 'soft-light',
  },
});

export default RewardsWelcomePopup;
