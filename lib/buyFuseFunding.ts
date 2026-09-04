/** Keep unavailable funding balances distinct from a confirmed zero balance. */
export const formatBuyFuseFundingBalance = (value: string | undefined): string => {
  if (!value?.trim()) return '—';

  const balance = Number(value);
  if (!Number.isFinite(balance) || balance < 0) return '—';

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(balance);
};
