import { formatUnits } from "viem";


export const SECONDS_PER_YEAR = 31_557_600;

export const calculateOriginalDepositAmount = (userDepositTransactions: any): number => {
    if (!userDepositTransactions?.deposits?.length) {
        return 0;
    }

    return userDepositTransactions.deposits.reduce(
        (total: number, deposit: any) => {
            try {
                if (!deposit.depositAmount || deposit.depositAmount === '0') {
                    return total;
                }

                const depositAmount = Number(
                    formatUnits(BigInt(deposit.depositAmount), 6)
                );

                if (isNaN(depositAmount) || !isFinite(depositAmount) || depositAmount < 0) {
                    console.warn('Invalid deposit amount:', deposit.depositAmount);
                    return total;
                }

                return total + depositAmount;
            } catch (error) {
                console.error('Error processing deposit amount:', error, deposit);
                return total;
            }
        },
        0
    );
};

export const getEarliestDepositTimestamp = (
    userDepositTransactions: any,
    fallbackTimestamp?: number
): number | undefined => {
    if (!userDepositTransactions?.deposits?.length) {
        return fallbackTimestamp;
    }

    const deposits = userDepositTransactions.deposits || [];
    const withdrawals = userDepositTransactions.withdraws || [];

    if (!withdrawals.length) {
        const earliestDeposit = deposits.reduce(
            (earliest: any, deposit: any) => {
                try {
                    const depositTime = Number(deposit.depositTimestamp);
                    if (isNaN(depositTime) || depositTime <= 0) {
                        return earliest;
                    }
                    const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
                    return depositTime < earliestTime ? deposit : earliest;
                } catch (error) {
                    console.error('Error parsing deposit timestamp:', error, deposit);
                    return earliest;
                }
            },
            null
        );
        return earliestDeposit ? Number(earliestDeposit.depositTimestamp) : fallbackTimestamp;
    }

    const mostRecentWithdrawal = withdrawals.reduce(
        (latest: any, withdrawal: any) => {
            const withdrawalTime = Number(withdrawal.creationTime);
            const latestTime = latest ? Number(latest.creationTime) : 0;
            return withdrawalTime > latestTime ? withdrawal : latest;
        },
        null
    );

    if (!mostRecentWithdrawal) {
        const earliestDeposit = deposits.reduce(
            (earliest: any, deposit: any) => {
                const depositTime = Number(deposit.depositTimestamp);
                const earliestTime = earliest ? Number(earliest.depositTimestamp) : Infinity;
                return depositTime < earliestTime ? deposit : earliest;
            },
            null
        );
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
                return depositTime < earliestTime ? deposit : earliest;
            },
            null
        );
        return Number(earliestDepositAfterWithdrawal.depositTimestamp);
    }

    const mostRecentDeposit = deposits.reduce(
        (latest: any, deposit: any) => {
            const depositTime = Number(deposit.depositTimestamp);
            const latestTime = latest ? Number(latest.depositTimestamp) : 0;
            return depositTime > latestTime ? deposit : latest;
        },
        null
    );

    return mostRecentDeposit ? Number(mostRecentDeposit.depositTimestamp) : fallbackTimestamp;
};

export const calculateCompoundInterest = (
    principal: number,
    apy: number,
    timeInSeconds: number
): number => {
    if (!isFinite(principal) || principal < 0) {
        console.warn('Invalid principal:', principal);
        return 0;
    }

    if (!isFinite(apy) || apy < 0) {
        console.warn('Invalid APY:', apy);
        return principal;
    }

    if (!isFinite(timeInSeconds) || timeInSeconds < 0) {
        console.warn('Invalid time:', timeInSeconds);
        return principal;
    }

    const timeInYears = timeInSeconds / SECONDS_PER_YEAR;
    const result = principal * Math.pow(1 + (apy / 100), timeInYears);

    if (!isFinite(result) || result < 0) {
        console.warn('Invalid compound interest result:', result);
        return principal;
    }

    return result;
}; 