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

import {
  type BankBalance,
  bankBalancesToShow,
  type CardBalanceDisplay,
  getTotalBalance,
  type OtherBalances,
  shouldShowCard,
  shouldShowSpendable,
} from './balanceTotals';
import OtherBalancesPie from './OtherBalancesPie';

export { bankBalancesToShow, getTotalBalance, shouldShowCard, shouldShowSpendable };
export type { BankBalance, CardBalanceDisplay, OtherBalances };

const WALLET_COLOR = '#FFFFFF';
const CARD_COLOR = '#94F27F'; // brand green
const SAVINGS_COLOR = '#7C5CFF'; // purple
const BANK_COLOR = '#F2B94F'; // amber — the one pot held outside Solid

/**
 * A bank balance in its own currency.
 *
 * `formatBalanceUSD` is USD-only, and these are the only figures on this screen
 * that are not. Intl gives the right symbol and placement per locale (€55.93,
 * $120.00) and degrades to the ISO code for a currency it does not know rather
 * than throwing, which is what an unrecognised value from Wirex would do.
 */
const formatCurrencyAmount = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
};

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

type PillProps = {
  walletValue: number;
  cardValue: number;
  savingsValue: number;
} & React.ComponentProps<typeof Pressable>;

/**
 * The dropdown pill trigger: a proportional Wallet/Card/Savings donut, the total
 * across all three and a chevron. Tapping opens the full breakdown.
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
  formattedValue,
  caption,
  isLoading,
  children,
}: {
  color: string;
  label: string;
  value: number;
  /**
   * Overrides the default USD rendering. Only the bank rows need it — they are
   * the one balance here that can be denominated in something other than USD.
   */
  formattedValue?: string;
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
        <Text className="text-2xl font-semibold text-white">
          {formattedValue ?? formatBalanceUSD(value)}
        </Text>
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
 * Spendable row (green — the colour the Card row would have used): how much of
 * what the user already holds their card can spend.
 *
 * Sits last because it is a reading of the rows above rather than another pot beside
 * them, and it only makes sense once you have seen the pots it draws on: the card
 * settles from USDC and USDT in Wallet and from soUSD in Savings, in that order, so
 * this figure spans both.
 *
 * No "Add", and not by omission. This is not a pot that can be topped up: the
 * money arrives through Wallet or Savings and shows up here on its own. An "Add"
 * here would imply a third destination.
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
    caption="Stablecoins and savings your card can spend"
    isLoading={isLoading}
  />
);

/**
 * Bank balance rows (amber) — money sitting in the user's Wirex account after a
 * SEPA or ACH deposit.
 *
 * One row per currency held. They are not summed into a single figure because
 * EUR and USD are not addable without a live rate, and are not folded into the
 * headline for the same reason (see `getTotalBalance`).
 *
 * No "Add" and no conversion to USD: this pot is filled by a bank transfer to
 * the user's IBAN or ACH details, and emptied by an outbound transfer from the
 * bank screen. Nothing in the app moves it, which is what the caption says.
 */
export const BankBalanceRows = ({
  balances,
  isLoading,
}: {
  balances: BankBalance[];
  isLoading?: boolean;
}) => (
  <>
    {balances.map((balance, index) => (
      <BalanceRow
        key={balance.tokenSymbol}
        color={BANK_COLOR}
        label={`Bank (${balance.currency})`}
        value={balance.amount}
        formattedValue={formatCurrencyAmount(balance.amount, balance.currency)}
        // Once, on the last row, so two rows do not repeat the same sentence.
        caption={
          index === balances.length - 1 ? 'Received by bank transfer, held at Wirex' : undefined
        }
        isLoading={isLoading}
      />
    ))}
  </>
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
 * The breakdown, in order: Wallet, Card (only when the card holds money of its
 * own), Savings, Bank, then Spendable.
 *
 * The first four are pots; Spendable closes the list because it is a reading of the
 * ones above it rather than a balance of its own. It also replaces Card for an issuer
 * whose card holds nothing — the two are alternatives, never both, since a $0 Card row
 * beside a funded Spendable one would read as money lost.
 *
 * Bank sits after Savings and only when there is something in it. It is the one
 * pot held outside Solid, so it is last among the real balances — and unlike the
 * others it is absent, not zero, for everyone who has never had a bank deposit.
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
  bankBalances = [],
}: OtherBalances &
  Partial<CardBalanceDisplay> & {
    onDismiss?: () => void;
    onCardAdd?: () => void;
    bankBalances?: BankBalance[];
  }) => {
  // Empty for everyone while `BANK_BALANCES_ENABLED` in useWirexBankAccounts is
  // off — the rows below stay wired up so re-enabling is one flag, not a revert.
  const bankRows = bankBalancesToShow(bankBalances);

  return (
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
      <SavingsBalanceRow
        savingsBalance={savingsBalance}
        isLoading={isLoading}
        onDismiss={onDismiss}
      />
      {bankRows.length > 0 && <BankBalanceRows balances={bankRows} isLoading={isLoading} />}
      {shouldShowSpendable({ userHasCard, cardHoldsOwnBalance }) && (
        <SpendableBalanceRow spendableBalance={spendableBalance} isLoading={isLoading} />
      )}
    </>
  );
};
