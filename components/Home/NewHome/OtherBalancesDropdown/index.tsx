import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, Info } from 'lucide-react-native';

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
 * the card before they can be spent), which the breakdown sheet spells out.
 */
export const getSpendableTotal = ({
  walletBalance,
  cardBalance,
  userHasCard,
}: Pick<OtherBalances, 'walletBalance' | 'cardBalance' | 'userHasCard'>) =>
  (walletBalance || 0) + (shouldShowCard(cardBalance, userHasCard) ? cardBalance || 0 : 0);

type PillProps = {
  /** Savings total — the balance that is NOT part of the headline. */
  savingsValue: number;
} & React.ComponentProps<typeof Pressable>;

/**
 * The dropdown pill trigger: savings ring + savings total + chevron. Wallet and
 * Card are already in the headline above, so the pill carries the remaining
 * balance — headline + pill = everything the user holds (no double counting).
 */
export const OtherBalancesPill = React.forwardRef<View, PillProps>(
  ({ savingsValue, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel="Show balance breakdown"
        className="flex-row items-center gap-2 self-center rounded-full bg-[#1C1C1C] py-2 pl-2 pr-3 transition-all active:scale-95 active:opacity-80"
        {...props}
      >
        <OtherBalancesPie
          cardValue={0}
          savingsValue={savingsValue}
          cardColor={CARD_COLOR}
          savingsColor={SAVINGS_COLOR}
        />
        <Text className="text-base font-semibold text-white">{formatBalanceUSD(savingsValue)}</Text>
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

/** Wallet balance row. "Add" opens the standard Add Funds (deposit) flow. */
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

/** Card balance row. "Add" opens the "Fund your card" popup (share deposit
 *  address / transfer from wallet) — the same modal used on the card screen. */
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

/**
 * Wallet + Card grouped together, matching the combined headline, with a note
 * making the separation explicit: the two are only added up for display, and
 * money has to be moved onto the card before it can be spent.
 */
export const SpendableBalancesGroup = ({
  walletBalance,
  cardBalance,
  userHasCard,
  isLoading,
}: Omit<OtherBalances, 'savingsBalance'>) => {
  const showCard = shouldShowCard(cardBalance, userHasCard);

  return (
    <View className="bg-white/[0.03] py-1">
      <WalletBalanceRow walletBalance={walletBalance} isLoading={isLoading} />
      {showCard && <CardBalanceRow cardBalance={cardBalance} isLoading={isLoading} />}
      {showCard && (
        <View className="flex-row items-start gap-2 px-5 pb-3 pt-1">
          <Info size={14} color="rgba(255,255,255,0.4)" />
          <Text className="flex-1 text-xs leading-4 text-white/40">
            Wallet and Card are added up in the balance above, but they&apos;re separate — move
            funds to your card to spend them.
          </Text>
        </View>
      )}
    </View>
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
