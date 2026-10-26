import { Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { BalanceHeadline } from '@/components/BalanceHeadline';
import SavingsFundedActions from '@/components/Savings/NewSavings/SavingsFundedActions';
import StartEarningButton from '@/components/Savings/NewSavings/StartEarningButton';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { type DepositOnItsWay, hasDepositMoving } from '@/lib/deposit/depositOnItsWay';
import { formatTokenAmount } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { isEurVault } from '@/lib/vaultCurrency';

import DepositOnItsWayRows from './DepositOnItsWayRows';
import { ApyTag, CheckDot, EarnChip, LockIcon } from './EarnChips';
import YieldIcon from './YieldIcon';
import { formatYieldAmount, formatYieldUsd, yieldProductName, yieldVault } from './yieldProducts';

/** One row under "Yields": a product, what it holds and its rate. */
export type EarnProduct = {
  type: VaultType;
  /** Undefined while it can't be valued — and always for EUR Yield, which has no USD value. */
  valueUsd: number | undefined;
  /** EUR Yield only: its value in euros. soEURC is never converted to dollars. */
  valueEur?: number;
  /** soUSD / soETH / soFUSE / soEURC held, for the line under the value. */
  shareAmount: number;
  /** FUSE locked for a tier: soFUSE in the lock, still earning FUSE Yield's rate. */
  lockedFuse?: number;
  /** USD Yield: dollars deposited that haven't reached it yet. */
  onItsWayUsd?: number;
  apy: number | undefined;
  isApyLoading: boolean;
};

const Stat = ({
  value,
  label,
  positive,
}: {
  /** Undefined while it loads. */
  value: string | undefined;
  label: string;
  positive?: boolean;
}) => (
  <View className="flex-1 items-center gap-[3px] px-1">
    {value === undefined ? (
      <Skeleton className="h-[22px] w-16 rounded-md bg-white/10" />
    ) : (
      <Text
        className={cn(
          'text-[17px] font-semibold leading-[22px]',
          positive ? 'text-[#94F27F]' : 'text-white',
        )}
        numberOfLines={1}
      >
        {value}
      </Text>
    )}
    <Text className="text-[13px] leading-[17px] text-white/50" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const StatDivider = () => <View className="h-9 w-px bg-[#2A2A2A]" />;

const ProductRow = ({
  product,
  isLoading,
  onPress,
}: {
  product: EarnProduct;
  isLoading: boolean;
  onPress: () => void;
}) => {
  const name = yieldProductName(product.type);
  const token = yieldVault(product.type).vaultToken;
  // Each product in its own currency: euros for EUR Yield, dollars for the rest.
  const isEur = isEurVault(product.type);
  const value = isEur ? product.valueEur : product.valueUsd;
  const funded = !isLoading && (value ?? 0) > 0;
  const locked = (product.lockedFuse ?? 0) > 0;
  const onItsWay = product.onItsWayUsd ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-[14px] active:bg-white/5"
    >
      <YieldIcon vaultType={product.type} />
      <View className="min-w-0 flex-1 items-start gap-[5px]">
        <Text className="text-[16px] font-semibold leading-5 text-white" numberOfLines={1}>
          {name}
        </Text>
        <ApyTag
          apy={product.apy}
          isLoading={product.isApyLoading}
          emptyLabel={isEur ? '— APY' : undefined}
        />
      </View>
      {isLoading ? (
        <Skeleton className="h-5 w-20 rounded-md bg-white/10" />
      ) : funded || onItsWay > 0 ? (
        <View className="shrink-0 items-end gap-[5px]">
          <Text className="text-[16px] font-semibold leading-5 text-white">
            {formatYieldAmount(value, product.type)}
          </Text>
          <View className="flex-row items-center gap-1">
            {locked && onItsWay <= 0 ? <LockIcon /> : null}
            <Text className="text-[13px] leading-[17px] text-white/50" numberOfLines={1}>
              {onItsWay > 0
                ? `+${formatYieldUsd(onItsWay)} on its way`
                : locked
                  ? `${formatNumber(product.lockedFuse ?? 0, 0)} FUSE locked`
                  : `${formatTokenAmount(product.shareAmount)} ${token}`}
            </Text>
          </View>
        </View>
      ) : (
        // Nothing in it yet: the row is a way in.
        <ChevronRight size={16} strokeWidth={1.6} color="rgba(255,255,255,0.35)" />
      )}
    </Pressable>
  );
};

export interface EarnViewProps {
  isLoading: boolean;
  /** Everything in Earn, locked FUSE included. Undefined while it loads. */
  total: number | undefined;
  /** "4.5% avg APY" once funded, "Up to 7.5% APY" before. Undefined while rates load. */
  apyLabel: string | undefined;
  /** Interest since the first deposit, all products. Undefined while it loads. */
  totalEarned: number | undefined;
  /** Interest added over the last 30 days. Undefined while it loads. */
  past30: number | undefined;
  products: EarnProduct[];
  onOpenProduct: (type: VaultType) => void;
  /** The yield boost card; it renders nothing for a user without one. */
  boost?: ReactNode;
  /** USD Yield deposits that haven't reached Earn yet, one row each under the balance. */
  depositsOnItsWay?: DepositOnItsWay[];
}

/**
 * The Earn tab (Figma 28551:5563 funded, 28551:5695 nothing deposited), laid out like a
 * savings account: what you hold and its rate, two actions, what it has earned, then one
 * row per product. Data comes in as props so the screen can be checked with any balance.
 */
export default function EarnView({
  isLoading,
  total,
  apyLabel,
  totalEarned,
  past30,
  products,
  onOpenProduct,
  boost,
  depositsOnItsWay = [],
}: EarnViewProps) {
  const isFunded = !isLoading && (total ?? 0) > 0;
  // A first deposit on its way takes Start earning's place: it has been started.
  const isFirstDepositMoving = !isFunded && hasDepositMoving(depositsOnItsWay);

  return (
    <View className="mx-auto w-full max-w-[419px] gap-6 px-4 pb-[140px] web:md:max-w-[40rem]">
      <View className="items-center gap-[6px]">
        {isLoading || total === undefined ? (
          <View className="items-center gap-1 pt-2">
            <Text className="text-base font-medium text-muted-foreground">Total in Earn</Text>
            <Skeleton className="h-[54px] w-[215px] rounded-xl bg-white/10" />
          </View>
        ) : (
          <BalanceHeadline balance={total} label="Total in Earn" />
        )}
        {apyLabel === undefined ? (
          <Skeleton className="h-7 w-[120px] rounded-full bg-white/10" />
        ) : (
          <EarnChip tone="positive" icon={<CheckDot />} label={apyLabel} />
        )}
      </View>

      <DepositOnItsWayRows deposits={depositsOnItsWay} />

      {isLoading ? (
        <Skeleton className="h-[50px] rounded-full bg-white/10" />
      ) : isFunded ? (
        <View className="-mx-4">
          <SavingsFundedActions vaultType={VaultType.USDC} />
        </View>
      ) : isFirstDepositMoving ? null : (
        <StartEarningButton vaultType={VaultType.USDC} className="px-0" source="earn_start" />
      )}

      <View className="gap-3">
        <Text className="text-[16px] leading-5 text-white/50">Balances</Text>
        <View className="flex-row items-center rounded-[20px] bg-[#1C1C1C] py-4">
          <Stat
            value={
              !isFunded
                ? formatYieldUsd(0)
                : totalEarned === undefined
                  ? undefined
                  : formatYieldUsd(totalEarned)
            }
            label="Total earned"
            positive={isFunded && (totalEarned ?? 0) > 0}
          />
          <StatDivider />
          <Stat
            value={
              !isFunded
                ? formatYieldUsd(0)
                : past30 === undefined
                  ? undefined
                  : `${past30 > 0 ? '+' : ''}${formatYieldUsd(past30)}`
            }
            label="Last 30 days"
            positive={isFunded && (past30 ?? 0) > 0}
          />
          <StatDivider />
          <Stat value="Daily" label="Interest added" />
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-[16px] leading-5 text-white/50">Yields</Text>
        <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
          {products.map((product, index) => (
            <Fragment key={product.type}>
              {index > 0 && <View className="h-px bg-[#2A2A2A]" />}
              <ProductRow
                product={product}
                isLoading={isLoading}
                onPress={() => onOpenProduct(product.type)}
              />
            </Fragment>
          ))}
        </View>
      </View>

      {boost}

      <Text className="px-4 text-center text-[13px] leading-[18px] text-white/40">
        APY is after fees and changes with the market. It is not guaranteed.
      </Text>
    </View>
  );
}
