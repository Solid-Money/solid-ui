import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardSpendableBalanceUSD } from '@/hooks/useCardSpendableBalance';
import { formatBalanceUSD } from '@/lib/utils';
import { canDepositToCard, cardHoldsBalance } from '@/lib/utils/cardHelpers';
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

/** What the Card / Spendable half of the breakdown depends on the issuer for. */
export type CardBalanceDisplay = {
  /** False for a card with no balance of its own — see `cardHoldsBalance`. */
  cardHoldsOwnBalance: boolean;
  /**
   * Whether the Card row offers "Add". Redundant with `cardHoldsOwnBalance` while
   * the two derive from the same rule — a card that holds no balance has no Card
   * row to put a button on — and kept separate so an issuer that holds a balance
   * the app cannot top up needs no new plumbing.
   */
  canAddToCard: boolean;
  /** USD of the user's holdings such a card can spend (`CARD_SPENDABLE_ASSETS`). */
  spendableBalance: number;
};

const WALLET_COLOR = '#FFFFFF';
const CARD_COLOR = '#94F27F'; // brand green
const SAVINGS_COLOR = '#7C5CFF'; // purple

/**
 * The issuer-dependent half of the breakdown, resolved once for whichever sheet
 * is mounted.
 *
 * The native and web sheets need exactly this and nothing else from the issuer, so
 * it lives here rather than being derived twice: three predicates duplicated across
 * two files is three chances for the row shown and the action offered on it to fall
 * out of step.
 */
export const useCardBalanceDisplay = (): CardBalanceDisplay => {
  const { provider } = useCardProvider();
  const { data: spendableBalance } = useCardSpendableBalanceUSD();

  return {
    cardHoldsOwnBalance: cardHoldsBalance(provider),
    canAddToCard: canDepositToCard(provider),
    spendableBalance,
  };
};

/**
 * Whether the Card belongs in the breakdown. Shown when the user has an active
 * card OR when there's a card balance to surface — so the balance isn't dropped
 * for testers whose card status isn't ACTIVE yet.
 *
 * A card with no balance of its own is never shown as a Card row: there is no
 * balance on it to report. That user gets the Spendable row instead.
 */
export const shouldShowCard = ({
  cardBalance,
  userHasCard,
  cardHoldsOwnBalance = true,
}: Pick<OtherBalances, 'cardBalance' | 'userHasCard'> &
  Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  cardHoldsOwnBalance && (userHasCard || (cardBalance || 0) > 0);

/**
 * Whether the Spendable row belongs in the breakdown: the user holds a card that
 * carries no balance of its own (Wirex), so what matters is how much of their own
 * money the card can reach.
 */
export const shouldShowSpendable = ({
  userHasCard,
  cardHoldsOwnBalance = true,
}: Pick<OtherBalances, 'userHasCard'> & Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  userHasCard && !cardHoldsOwnBalance;

/**
 * Everything the user holds, and the home headline: Wallet + Card + Savings.
 *
 * Card is only added when it is a pot of its own. For a Wirex card the reported
 * balance is spendable soUSD — savings seen from the card's side — and adding it
 * would count the same money twice, inflating the headline by however much the
 * card could reach. Spendable is a view onto savings for the same reason and never
 * enters a total.
 */
export const getTotalBalance = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  cardHoldsOwnBalance = true,
}: Omit<OtherBalances, 'isLoading'> & Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  (walletBalance || 0) +
  (shouldShowCard({ cardBalance, userHasCard, cardHoldsOwnBalance }) ? cardBalance || 0 : 0) +
  (savingsBalance || 0);

type PillProps = {
  walletValue: number;
  cardValue: number;
  savingsValue: number;
} & React.ComponentProps<typeof Pressable>;

/**
 * The dropdown pill trigger: a proportional Wallet/Card/Savings donut, the word
 * "Balances" and a chevron. Tapping opens the full breakdown.
 *
 * It used to carry the total too. The headline above it is that same total now, so
 * the pill said the number twice; naming what it opens is the part the headline
 * cannot say, and the donut still shows the composition at a glance.
 */
export const OtherBalancesPill = React.forwardRef<View, PillProps>(
  ({ walletValue, cardValue, savingsValue, ...props }, ref) => (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel="Show balance breakdown"
      className="h-[35px] flex-row items-center gap-[10px] self-center rounded-full bg-[#1C1C1C] pl-[13px] pr-[12px] transition-all active:scale-95 active:opacity-80"
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
        Balances
      </Text>
      <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
    </Pressable>
  ),
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
  caption,
  isLoading,
  children,
}: {
  color: string;
  label: string;
  value: number;
  /** Optional line under the figure, for a row whose meaning isn't self-evident. */
  caption?: string;
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
      {!isLoading && !!caption && (
        <Text className="text-xs font-medium text-muted-foreground">{caption}</Text>
      )}
    </View>
    {children}
  </View>
);

/** Wallet balance row (white). "Add" opens the standard Add Funds flow. */
export const WalletBalanceRow = ({
  walletBalance,
  isLoading,
  onDismiss,
}: {
  walletBalance: number;
  isLoading?: boolean;
  onDismiss?: () => void;
}) => (
  <BalanceRow color={WALLET_COLOR} label="Wallet" value={walletBalance} isLoading={isLoading}>
    <DepositOptionModal onBeforeOpen={onDismiss} trigger={<AddButton />} />
  </BalanceRow>
);

/**
 * Card balance row (green). "Add" opens the "Fund your card" popup (share deposit
 * address / transfer from wallet) — same modal as the card screen.
 *
 * Only for a card that holds a balance. A Wirex cardholder gets
 * {@link SpendableBalanceRow} in this slot instead.
 */
export const CardBalanceRow = ({
  cardBalance,
  isLoading,
  onAdd,
  canAdd = true,
}: {
  cardBalance: number;
  isLoading?: boolean;
  onAdd?: () => void;
  canAdd?: boolean;
}) => (
  <BalanceRow color={CARD_COLOR} label="Card" value={cardBalance} isLoading={isLoading}>
    {canAdd ? <AddButton onPress={onAdd} /> : null}
  </BalanceRow>
);

/**
 * Spendable row (green — it stands where the Card row would): how much of what the
 * user already holds their card can spend.
 *
 * No "Add", and not by omission. This is not a pot that can be topped up: it is a
 * slice of the balances above it, so the money arrives through Wallet or Savings
 * and shows up here on its own. An "Add" here would imply a third destination.
 */
export const SpendableBalanceRow = ({
  spendableBalance,
  isLoading,
}: {
  spendableBalance: number;
  isLoading?: boolean;
}) => (
  <BalanceRow
    color={CARD_COLOR}
    label="Spendable"
    value={spendableBalance}
    caption="Of your savings, available to your card"
    isLoading={isLoading}
  />
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
      modal={DEPOSIT_MODAL.OPEN_SAVINGS_FUND}
      preserveSelectedVault
      source="home_other_balances"
      onBeforeOpen={() => {
        onDismiss?.();
        useDepositStore.getState().setDepositFromSolid(false);
      }}
      trigger={<AddButton />}
    />
  </BalanceRow>
);

/**
 * The breakdown, in order: Wallet, then Card **or** Spendable depending on whether
 * the card holds money of its own, then Savings.
 *
 * Card and Spendable are alternatives, never both: they answer the same question
 * for two kinds of card, and showing a $0 Card row beside a Spendable one would
 * read as money the user had lost.
 */
export const BalanceBreakdownRows = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  isLoading,
  onDismiss,
  onCardAdd,
  cardHoldsOwnBalance = true,
  canAddToCard = true,
  spendableBalance = 0,
}: OtherBalances &
  Partial<CardBalanceDisplay> & {
    onDismiss?: () => void;
    onCardAdd?: () => void;
  }) => (
  <>
    <WalletBalanceRow walletBalance={walletBalance} isLoading={isLoading} onDismiss={onDismiss} />
    {shouldShowCard({ cardBalance, userHasCard, cardHoldsOwnBalance }) && (
      <CardBalanceRow
        cardBalance={cardBalance}
        isLoading={isLoading}
        onAdd={onCardAdd}
        canAdd={canAddToCard}
      />
    )}
    {shouldShowSpendable({ userHasCard, cardHoldsOwnBalance }) && (
      <SpendableBalanceRow spendableBalance={spendableBalance} isLoading={isLoading} />
    )}
    <SavingsBalanceRow
      savingsBalance={savingsBalance}
      isLoading={isLoading}
      onDismiss={onDismiss}
    />
  </>
);
