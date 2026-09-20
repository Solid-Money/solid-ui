import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/lib/tierNames';
import { formatFuse, formatMembershipDay } from '@/lib/tierUpgrade';
import { RewardsTier, type TierLockState } from '@/lib/types';

interface LockedFuseTileProps {
  lock: TierLockState;
  onPress: () => void;
}

/**
 * The FUSE a user has committed to hold a tier, shown apart from their savings.
 *
 * Its own row rather than folded into the FUSE vault tile, because it behaves
 * differently in the one way that matters: it cannot be withdrawn until its
 * date. Adding it to the savings figure would make the Earn page promise a
 * balance the withdraw flow then refuses, which is worse than a second line.
 *
 * It is still earning — what is locked is the vault share, not the asset — so
 * the tile says so rather than reading as money set aside and idle.
 */
const LockedFuseTile = ({ lock, onPress }: LockedFuseTileProps) => {
  if (!lock.enabled || lock.lockedFuse <= 0) return null;

  const unlockLabel =
    lock.maturedFuse > 0
      ? 'Unlocking now'
      : lock.nextUnlockAt
        ? `Unlocks ${formatMembershipDay(lock.nextUnlockAt)}`
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your locked FUSE"
      onPress={onPress}
      className="rounded-[20px] bg-[#1C1C1C] p-4 transition-all active:scale-[0.99] active:opacity-90"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[16px] font-semibold leading-5 text-white">Locked FUSE</Text>

        {lock.unlockedTier !== RewardsTier.CORE ? (
          <View className="rounded-full border border-[#94F27F]/15 bg-[#94F27F]/10 px-[10px] py-1">
            <Text className="text-[13px] font-medium leading-4 text-[#94F27F]">
              {getTierDisplayName(lock.unlockedTier)}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-2 text-[24px] font-semibold leading-7 text-white">
        {formatFuse(lock.lockedFuse)} FUSE
      </Text>

      <Text className="mt-1 text-[14px] leading-5 text-white/50">
        {unlockLabel ? `${unlockLabel} · still earning` : 'Still earning while locked'}
      </Text>
    </Pressable>
  );
};

export default LockedFuseTile;
