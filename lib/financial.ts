import { formatUnits } from 'viem';

import { SavingMode } from './types';

export const SECONDS_PER_YEAR = 31_557_600;

export const calculateYield = (
  balance: number,
  apy: number,
  lastTimestamp: number,
  currentTime: number,
  principal?: number,
  mode: SavingMode = SavingMode.TOTAL,
): number => {
  if (balance <= 0 || !isFinite(balance)) return 0;
  if (!isFinite(apy) || apy < 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;
  if (!lastTimestamp || lastTimestamp <= 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;
  if (!currentTime || currentTime <= 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;

  const deltaTime = Math.max(0, currentTime - lastTimestamp);
  if (deltaTime === 0) return mode === SavingMode.INTEREST_ONLY ? 0 : balance;

  const timeInYears = deltaTime / SECONDS_PER_YEAR;

  if (principal && principal > 0) {
    const compoundedValue = principal * Math.pow(1 + apy / 100, timeInYears);

    if (mode === SavingMode.INTEREST_ONLY) {
      return Math.max(0, compoundedValue - principal);
    }
    return compoundedValue;
  }

  const interestEarned = balance * (apy / 100) * timeInYears;

  if (mode === SavingMode.INTEREST_ONLY) {
    return Math.max(0, interestEarned);
  }

  return balance + interestEarned;
};

export const calculateOriginalDepositAmount = (userDepositTransactions: any): number => {
  if (!userDepositTransactions?.deposits?.length) {
    return 0;
  }

  return userDepositTransactions.deposits.reduce((total: number, deposit: any) => {
    if (!deposit.depositAmount || deposit.depositAmount === '0') {
      return total;
    }

    try {
      const depositAmount = Number(formatUnits(BigInt(deposit.depositAmount), 6));

      return isFinite(depositAmount) && depositAmount > 0 ? total + depositAmount : total;
    } catch {
      return total;
    }
  }, 0);
};

export const getEarliestDepositTimestamp = (
  userDepositTransactions: any,
  fallbackTimestamp?: number,
): number | undefined => {
  if (!userDepositTransactions?.deposits?.length) {
    return fallbackTimestamp;
  }

  const deposits = userDepositTransactions.deposits || [];
  const withdrawals = userDepositTransactions.withdraws || [];

  if (!withdrawals.length) {
    const earliestDeposit = deposits.reduce((earliest: any, deposit: any) => {
      const depositTime = Number(deposit.depositTimestamp);
      const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
      return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
    }, null);
    return earliestDeposit ? Number(earliestDeposit.depositTimestamp) : fallbackTimestamp;
  }

  const mostRecentWithdrawal = withdrawals.reduce((latest: any, withdrawal: any) => {
    const withdrawalTime = Number(withdrawal.creationTime);
    const latestTime = latest ? Number(latest.creationTime) : 0;
    return withdrawalTime > latestTime ? withdrawal : latest;
  }, null);

  if (!mostRecentWithdrawal) {
    const earliestDeposit = deposits.reduce((earliest: any, deposit: any) => {
      const depositTime = Number(deposit.depositTimestamp);
      const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
      return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
    }, null);
    return earliestDeposit ? Number(earliestDeposit.depositTimestamp) : fallbackTimestamp;
  }

  const mostRecentWithdrawalTime = Number(mostRecentWithdrawal.creationTime);

  const depositsAfterWithdrawal = deposits.filter((deposit: any) => {
    return Number(deposit.depositTimestamp) > mostRecentWithdrawalTime;
  });

  if (depositsAfterWithdrawal.length > 0) {
    const earliestDepositAfterWithdrawal = depositsAfterWithdrawal.reduce(
      (earliest: any, deposit: any) => {
        const depositTime = Number(deposit.depositTimestamp);
        const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
        return depositTime > 0 && depositTime < earliestTime ? deposit : earliest;
      },
      null,
    );
    return Number(earliestDepositAfterWithdrawal.depositTimestamp);
  }

  const mostRecentDeposit = deposits.reduce((latest: any, deposit: any) => {
    const depositTime = Number(deposit.depositTimestamp);
    const latestTime = latest ? Number(latest.depositTimestamp) : 0;
    return depositTime > latestTime ? deposit : latest;
  }, null);

  return mostRecentDeposit ? Number(mostRecentDeposit.depositTimestamp) : fallbackTimestamp;
};
