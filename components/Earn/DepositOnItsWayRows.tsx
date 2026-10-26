import { type ReactNode, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Href, router } from 'expo-router';
import { ChevronRight, CircleAlert, Clock } from 'lucide-react-native';

import { formatYieldUsd } from '@/components/Earn/yieldProducts';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import type { DepositOnItsWay, DepositOnItsWayState } from '@/lib/deposit/depositOnItsWay';

const SPIN_MS = 1400;

/** The green arc turning on its track: the deposit is moving. */
const MovingRing = () => {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(rotation);
    rotation.value = 0;
    if (!reduceMotion) {
      rotation.value = withRepeat(
        withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View style={style}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Circle cx={10} cy={10} r={8} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
        <Path d="M10 2A8 8 0 0 1 18 10" stroke="#94F27F" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
};

const ROW: Record<
  DepositOnItsWayState,
  { title: (amount: string) => string; subtitle: string; icon: () => ReactNode }
> = {
  on_its_way: {
    title: amount => `${amount} on its way`,
    subtitle: 'Usually takes a few minutes',
    icon: () => <MovingRing />,
  },
  taking_longer: {
    title: amount => `${amount} is taking longer`,
    subtitle: 'Tap to get help from support',
    icon: () => <Clock size={20} strokeWidth={1.75} color="#ECDC76" />,
  },
  failed: {
    title: amount => `${amount} didn't go through`,
    subtitle: 'Tap to see what happened',
    icon: () => <CircleAlert size={20} strokeWidth={1.75} color="#F87171" />,
  },
};

const openDeposit = ({ clientTxId, amount, state }: DepositOnItsWay) => {
  if (state !== 'taking_longer') {
    router.push(`/activity/${clientTxId}` as Href);
    return;
  }
  const label = `Deposit to USD Yield · ${formatYieldUsd(amount)}`;
  openSupportDrawer({
    chatMessage: `My ${formatYieldUsd(amount)} deposit to USD Yield is taking longer than usual.\n\nTransaction ID: ${clientTxId}\n\nMy question: `,
    context: { kind: 'activity', id: clientTxId, label },
  });
};

export const DepositOnItsWayRow = ({ deposit }: { deposit: DepositOnItsWay }) => {
  const row = ROW[deposit.state];
  const title = row.title(formatYieldUsd(deposit.amount));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${row.subtitle}`}
      onPress={() => openDeposit(deposit)}
      className="flex-row items-center gap-[14px] rounded-[20px] bg-[#1C1C1C] p-4 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
        {row.icon()}
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text className="text-[16px] font-semibold leading-[23px] text-white" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[14px] leading-5 text-white/60" numberOfLines={1}>
          {row.subtitle}
        </Text>
      </View>
      <ChevronRight size={16} strokeWidth={1.6} color="rgba(255,255,255,0.35)" />
    </Pressable>
  );
};

/**
 * One row per USD Yield deposit that hasn't reached Earn: on its way, taking longer
 * (opens support) or didn't go through. Each opens its deposit in Activity otherwise.
 * Renders nothing when there are none.
 */
export default function DepositOnItsWayRows({
  deposits,
  className,
}: {
  deposits: DepositOnItsWay[];
  className?: string;
}) {
  if (!deposits.length) return null;
  return (
    <View className={cn('gap-2', className)}>
      {deposits.map(deposit => (
        <DepositOnItsWayRow key={deposit.clientTxId} deposit={deposit} />
      ))}
    </View>
  );
}
