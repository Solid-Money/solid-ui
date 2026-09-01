import { BalanceHeadline } from '@/components/BalanceHeadline';

interface WalletBalanceHeadlineProps {
  balance: number;
}

/**
 * "Wallet Balance" label + big number for the redesigned home screen.
 * `balance` is Wallet + Card combined (see getSpendableTotal) — the two are
 * added up for display only and broken out in the balances sheet. Savings is
 * excluded; it lives behind the OtherBalancesDropdown pill.
 */
const WalletBalanceHeadline = ({ balance }: WalletBalanceHeadlineProps) => {
  return <BalanceHeadline balance={balance} label="Wallet Balance" />;
};

export default WalletBalanceHeadline;
