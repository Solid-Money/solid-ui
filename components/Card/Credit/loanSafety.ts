import { type LoanModel, type LoanStatus, WAD } from '@/lib/creditRisk';

export type LoanSafetyStatus = LoanStatus | 'unknown';

// The Credit page warns before the on-chain sell point. LoanModel.status still governs sale
// eligibility and the wording of sale countdowns and repayment quotes.
const AT_RISK_WARNING_HF = (102n * WAD) / 100n;

export const loanSafetyStatus = (loan: LoanModel): LoanSafetyStatus => {
  if (loan.debtUsd === 0n) return 'healthy';
  if (loan.risk.kind === 'unpriced' || loan.assets.some(asset => !asset.priceInBand))
    return 'unknown';
  return loan.healthFactorWad < AT_RISK_WARNING_HF ? 'at-risk' : loan.status;
};

const SEVERITY: Record<LoanSafetyStatus, number> = {
  healthy: 0,
  unknown: 1,
  caution: 2,
  'at-risk': 3,
};

export const summarizeLoanSafety = (loans: readonly LoanModel[], isIncomplete: boolean) => {
  const positions = loans
    .filter(loan => loan.debtUsd > 0n)
    .sort((a, b) => a.chainId - b.chainId)
    .map(loan => ({ loan, status: loanSafetyStatus(loan) }));
  const status = positions.reduce<LoanSafetyStatus>(
    (worst, position) => (SEVERITY[position.status] > SEVERITY[worst] ? position.status : worst),
    isIncomplete ? 'unknown' : 'healthy',
  );
  const flagged = positions.filter(position => position.status === status);
  return { positions, status, affectedLoan: flagged.length === 1 ? flagged[0].loan : null };
};
