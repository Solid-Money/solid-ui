import { BalanceHeadline } from '@/components/BalanceHeadline';

interface WalletBalanceHeadlineProps {
  balance: number;
}

/**
 * "Balance" label + big number for the redesigned home screen.
 *
 * `balance` is everything the user holds — Wallet + Card + Savings (see
 * `getTotalBalance`) — combined for display only; the pill below opens the
 * breakdown that keeps them apart. It used to be Wallet + Card with Savings left
 * to the pill, which meant the biggest figure on the screen answered a question
 * ("what is in my wallet?") that nobody was asking at a glance, and the number the
 * user came for was the small one underneath it.
 */
const WalletBalanceHeadline = ({ balance }: WalletBalanceHeadlineProps) => {
  return <BalanceHeadline balance={balance} label="Balance" />;
};

export default WalletBalanceHeadline;
