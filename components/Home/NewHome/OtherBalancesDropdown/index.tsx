import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { formatBalanceUSD } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

/** Data required by both the native and web "other balances" sheets. */
export type OtherBalances = {
  cardBalance: number;
  savingsBalance: number;
  userHasCard: boolean;
  isLoading?: boolean;
};

const CARD_COLOR = '#94F27F'; // brand green
const SAVINGS_COLOR = '#7C5CFF'; // purple

/** Combined "other balances" figure shown on the pill. */
export const getOtherBalancesTotal = ({
  cardBalance,
  savingsBalance,
  userHasCard,
}: OtherBalances) => (userHasCard ? cardBalance || 0 : 0) + (savingsBalance || 0);

type PillProps = {
  total: number;
  hasBalance: boolean;
} & React.ComponentProps<typeof Pressable>;

/** The dropdown pill trigger: colored ring + combined total + chevron. */
export const OtherBalancesPill = React.forwardRef<View, PillProps>(
  ({ total, hasBalance, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel="Show other balances"
        className="flex-row items-center gap-2 self-center rounded-full bg-[#1C1C1C] py-2 pl-2 pr-3 transition-all active:scale-95 active:opacity-80"
        {...props}
      >
        {hasBalance ? (
          <LinearGradient
            colors={[CARD_COLOR, SAVINGS_COLOR]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 20, height: 20, borderRadius: 10, padding: 2 }}
          >
            <View style={{ flex: 1, borderRadius: 8, backgroundColor: '#1C1C1C' }} />
          </LinearGradient>
        ) : (
          <View className="h-5 w-5 rounded-full border-2 border-[#3A3A3A]" />
        )}
        <Text className="text-base font-semibold text-white">{formatBalanceUSD(total)}</Text>
        <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
      </Pressable>
    );
  },
);
OtherBalancesPill.displayName = 'OtherBalancesPill';

/** Small white "Add" pill. Works standalone (onPress) or as a modal trigger. */
export const AddButton = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    className="rounded-full bg-white px-5 py-2 transition-all active:scale-95 active:opacity-80"
    {...props}
  >
    <Text className="text-sm font-bold text-black">Add</Text>
  </Pressable>
);

const BalanceRow = ({
  color,
  label,
  value,
  isLoading,
  children,
}: {
  color: string;
  label: string;
  value: number;
  isLoading?: boolean;
  children?: React.ReactNode;
}) => (
  <View className="flex-row items-center justify-between px-5 py-3">
    <View className="flex-1 gap-1">
      <View className="flex-row items-center gap-2">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      </View>
      {isLoading ? (
        <Skeleton className="h-7 w-24 rounded-lg" />
      ) : (
        <Text className="text-2xl font-semibold text-white">{formatBalanceUSD(value)}</Text>
      )}
    </View>
    {children}
  </View>
);

/** Card balance row. "Add" navigates to the existing card deposit flow. */
export const CardBalanceRow = ({
  cardBalance,
  isLoading,
  onDismiss,
}: {
  cardBalance: number;
  isLoading?: boolean;
  onDismiss?: () => void;
}) => {
  const router = useRouter();
  return (
    <BalanceRow color={CARD_COLOR} label="Card" value={cardBalance} isLoading={isLoading}>
      <AddButton
        onPress={() => {
          onDismiss?.();
          router.push(path.CARD_DEPOSIT);
        }}
      />
    </BalanceRow>
  );
};

/** Savings balance row. "Add" opens the existing savings deposit modal (global). */
export const SavingsBalanceRow = ({
  savingsBalance,
  isLoading,
  onDismiss,
}: {
  savingsBalance: number;
  isLoading?: boolean;
  onDismiss?: () => void;
}) => (
  <BalanceRow color={SAVINGS_COLOR} label="Savings" value={savingsBalance} isLoading={isLoading}>
    <DepositTrigger
      modal={DEPOSIT_MODAL.OPEN_FORM}
      preserveSelectedVault
      source="home_other_balances"
      onBeforeOpen={() => {
        onDismiss?.();
        useDepositStore.getState().setDepositFromSolid(true);
      }}
      trigger={<AddButton />}
    />
  </BalanceRow>
);
