import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { PointsProgress } from '@/components/Rewards/NewRewards/TierUpgradeCard';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useAddToEarn, useTierBalance } from '@/hooks/useTierBalance';
import { track } from '@/lib/analytics';
import { trackNeedsTopUp, trackNudgeCopy, trackProgress } from '@/lib/tierBalance';
import { cn } from '@/lib/utils';

interface EarnTierBalanceCardProps {
  className?: string;
}

/**
 * The "Hold in Earn" route on the Earn page: how far the balance here is from
 * unlocking (or keeping) a tier, laid out like the yield boost card beside it,
 * with the points card's progress bar.
 *
 * Every figure is the backend's — the shortfall, the threshold, the days — and
 * the card draws nothing for anyone the route is not staged to, or for an Ultra
 * member by another route, who has nothing left to unlock.
 */
const EarnTierBalanceCard = ({ className }: EarnTierBalanceCardProps) => {
  const { balance, relevant } = useTierBalance();
  const addToEarn = useAddToEarn('earn');

  // Reported once per tier and state.
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (!relevant) return;
    const key = `${relevant.tier}:${relevant.status}`;
    if (viewed.current === key) return;
    viewed.current = key;
    track(TRACKING_EVENTS.TIER_BALANCE_OPTION_VIEWED, {
      route: 'balance',
      tier: relevant.tier,
      status: relevant.status,
      surface: 'earn',
    });
  }, [relevant]);

  if (!balance || !relevant) return null;

  const { title, body } = trackNudgeCopy(relevant, balance);
  const progress = trackProgress(relevant, balance);
  const canAdd = trackNeedsTopUp(relevant);

  return (
    <View className={cn('overflow-hidden rounded-[20px] bg-card', className)}>
      <View className="gap-3 px-4 py-[18px]">
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1 gap-[5px]">
            <Text className="text-[16px] font-semibold leading-5 text-white">{title}</Text>
            <Text className="text-[14px] leading-[18px] text-white/50">{body}</Text>
          </View>
          {canAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Deposit to Earn. ${title}`}
              onPress={() => addToEarn(relevant)}
              className="h-[37px] min-w-[80px] items-center justify-center rounded-full bg-[#94F27F] px-[21px] transition-all active:scale-95 active:opacity-80"
            >
              <Text
                className="text-black"
                style={{ fontFamily: 'MonaSans_600SemiBold', fontSize: 16, lineHeight: 20 }}
              >
                Deposit
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View className="flex-row items-center gap-[10px]">
          <PointsProgress percent={progress.percent} />
          <View className="flex-row items-baseline">
            {progress.value ? (
              <Text className="text-[14px] leading-[18px] text-white">{progress.value}</Text>
            ) : null}
            <Text className="text-[14px] leading-[18px] text-white/50">{progress.target}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default EarnTierBalanceCard;
