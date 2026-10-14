import { Fragment } from 'react';
import { View } from 'react-native';
import { ArrowUp, Award, CreditCard, RefreshCw, TrendingUp } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

type Benefit = { key: string; icon: typeof ArrowUp; title: string; body: string };

const NOTHING_TO_MANAGE: Benefit = {
  key: 'manage',
  icon: RefreshCw,
  title: 'Nothing to manage',
  body: 'Interest is added to your balance automatically. Nothing to claim.',
};

/** Only what is true of each product: soUSD backs the card, soETH and soFUSE do not. */
const BENEFITS: Record<VaultType, Benefit[]> = {
  [VaultType.USDC]: [
    {
      key: 'withdraw',
      icon: ArrowUp,
      title: 'Withdraw anytime',
      body: 'Most withdrawals finish within minutes, with no exit fee.',
    },
    {
      key: 'spend',
      icon: CreditCard,
      title: 'Spend while it earns',
      body: 'soUSD backs your Solid card, so your dollars earn until you spend them.',
    },
    NOTHING_TO_MANAGE,
  ],
  [VaultType.ETH]: [
    {
      key: 'exposure',
      icon: TrendingUp,
      title: 'Keep your ETH',
      body: 'soETH tracks ETH, so you keep your exposure and earn on top of it.',
    },
    {
      key: 'withdraw',
      icon: ArrowUp,
      title: 'Withdraw anytime',
      body: 'Move it back to your wallet whenever you need it.',
    },
    NOTHING_TO_MANAGE,
  ],
  [VaultType.FUSE]: [
    {
      key: 'tier',
      icon: Award,
      title: 'Counts for your tier',
      body: 'Your FUSE Yield deposit counts toward Prime or Ultra through Skip the Line.',
    },
    {
      key: 'exposure',
      icon: TrendingUp,
      title: 'Keep your FUSE',
      body: 'soFUSE tracks FUSE, so you keep your exposure and earn on top of it.',
    },
    NOTHING_TO_MANAGE,
  ],
};

/**
 * Figma 28501:5185 — why this product, in three rows. The same card opens the How it works
 * sheet, so the page and the sheet never say the same thing two ways.
 */
const YieldBenefitsCard = ({
  vaultType,
  className,
}: {
  vaultType: VaultType;
  /** The sheet puts it on #1C1C1C, so it lifts the surface to #282828 there. */
  className?: string;
}) => (
  <View className={cn('overflow-hidden rounded-[20px] bg-[#1C1C1C]', className)}>
    {BENEFITS[vaultType].map(({ key, icon: Icon, title, body }, index) => (
      <Fragment key={key}>
        {index > 0 && <View className="h-px bg-white/[0.08]" />}
        <View className="flex-row gap-[14px] p-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Icon size={20} strokeWidth={1.75} color="#ffffff" />
          </View>
          <View className="min-w-0 flex-1 gap-[3px]">
            <Text className="text-[16px] font-semibold leading-[23px] text-white">{title}</Text>
            <Text className="text-[14px] leading-5 text-white/60">{body}</Text>
          </View>
        </View>
      </Fragment>
    ))}
  </View>
);

export default YieldBenefitsCard;
