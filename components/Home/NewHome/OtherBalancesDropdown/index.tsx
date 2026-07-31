import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { formatBalanceUSD } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

import OtherBalancesPie from './OtherBalancesPie';

/** Data required by both the native and web balances sheets. */
export type OtherBalances = {
  walletBalance: number;
  cardBalance: number;
  savingsBalance: number;
  userHasCard: boolean;
  isLoading?: boolean;
};

const WALLET_COLOR = '#FFFFFF';
const CARD_COLOR = '#94F27F'; // brand green
const SAVINGS_COLOR = '#7C5CFF'; // purple

/**
 * Whether the Card belongs in the breakdown. Shown when the user has an active
 * card OR when there's a card balance to surface — so the balance isn't dropped
 * for testers whose card status isn't ACTIVE yet.
 */
export const shouldShowCard = (cardBalance: number, userHasCard: boolean) =>
  userHasCard || (cardBalance || 0) > 0;

/**
 * The headline figure: Wallet + Card. They're combined in the UI only — the two
 * balances stay separate under the hood (funds must be moved from the wallet to
 * the card before they can be spent), which the breakdown sheet lays out.
 */
export const getSpendableTotal = ({
  walletBalance,
  cardBalance,
  userHasCard,
}: Pick<OtherBalances, 'walletBalance' | 'cardBalance' | 'userHasCard'>) =>
  (walletBalance || 0) + (shouldShowCard(cardBalance, userHasCard) ? cardBalance || 0 : 0);

/** Everything the user holds: Wallet + Card + Savings (the pill's figure). */
export const getTotalBalance = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
}: OtherBalances) =>
  getSpendableTotal({ walletBalance, cardBalance, userHasCard }) + (savingsBalance || 0);

type PillProps = {
  walletValue: number;
  cardValue: number;
  savingsValue: number;
} & React.ComponentProps<typeof Pressable>;

/**
 * The dropdown pill trigger: a proportional Wallet/Card/Savings donut + the
 * total across all three + chevron. Tapping opens the full breakdown.
 */
export const OtherBalancesPill = React.forwardRef<View, PillProps>(
  ({ walletValue, cardValue, savingsValue, ...props }, ref) => {
    const total = (walletValue || 0) + (cardValue || 0) + (savingsValue || 0);

    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel="Show balance breakdown"
        className="h-[35px] min-w-[120px] flex-row items-center gap-[10px] self-center rounded-full bg-[#1C1C1C] pl-[13px] pr-[12px] transition-all active:scale-95 active:opacity-80"
        {...props}
      >
        <OtherBalancesPie
          walletValue={walletValue}
          cardValue={cardValue}
          savingsValue={savingsValue}
          walletColor={WALLET_COLOR}
          cardColor={CARD_COLOR}
          savingsColor={SAVINGS_COLOR}
        />
        <Text
          className="font-semibold text-white"
          style={{
            fontFamily: 'MonaSans_600SemiBold',
            fontSize: 16,
            fontWeight: '600',
            lineHeight: 18,
          }}
        >
          {formatBalanceUSD(total)}
        </Text>
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

/** Wallet balance row (white). "Add" opens the standard Add Funds flow. */
export const WalletBalanceRow = ({
  walletBalance,
  isLoading,
}: {
  walletBalance: number;
  isLoading?: boolean;
}) => (
  <BalanceRow color={WALLET_COLOR} label="Wallet" value={walletBalance} isLoading={isLoading}>
    <DepositOptionModal trigger={<AddButton />} />
  </BalanceRow>
);

/** Card balance row (green). "Add" opens the "Fund your card" popup (share
 *  deposit address / transfer from wallet) — same modal as the card screen. */
export const CardBalanceRow = ({
  cardBalance,
  isLoading,
}: {
  cardBalance: number;
  isLoading?: boolean;
  // Accepted for parity with SavingsBalanceRow; the popup opens over the sheet.
  onDismiss?: () => void;
}) => (
  <BalanceRow color={CARD_COLOR} label="Card" value={cardBalance} isLoading={isLoading}>
    <CardDirectDepositModal trigger={<AddButton />} />
  </BalanceRow>
);

/** Savings balance row (purple). "Add" opens the savings deposit modal (global). */
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

/** The three balances, in order: Wallet, Card (when relevant), Savings. */
export const BalanceBreakdownRows = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
  onDismiss,
}: OtherBalances & { onDismiss?: () => void }) => (
  <>
    <WalletBalanceRow walletBalance={walletBalance} isLoading={isLoading} />
    {shouldShowCard(cardBalance, userHasCard) && (
      <CardBalanceRow cardBalance={cardBalance} isLoading={isLoading} onDismiss={onDismiss} />
    )}
    <SavingsBalanceRow
      savingsBalance={savingsBalance}
      isLoading={isLoading}
      onDismiss={onDismiss}
    />
  </>
);
